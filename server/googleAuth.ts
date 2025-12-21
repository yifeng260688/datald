import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { createSessionStore } from "./mongodb";

let storage: any;

export function setStorage(s: any) {
  storage = s;
}

export function getSession(mongoConnected: boolean) {
  const sessionTtl = 24 * 60 * 60 * 1000; // 1 day (Giảm xuống 1 ngày cho nhẹ DB)
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Cấu hình cơ bản
  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "default_secret_key_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // QUAN TRỌNG: Trên Vultr (HTTPS) bắt buộc true. Local (HTTP) là false.
      secure: isProduction, 
      // QUAN TRỌNG: 'lax' là tốt nhất cho OAuth redirect cùng domain
      sameSite: 'lax', 
      maxAge: sessionTtl,
    },
  };

  // Logic chọn nơi lưu Session (Mongo vs Memory)
  if (mongoConnected) {
    try {
      console.log("[Session] Attempting to use MongoDB Store");
      sessionConfig.store = createSessionStore(mongoConnected);
    } catch (err) {
      console.error("[Session] Failed to create MongoStore, falling back to MemoryStore", err);
      // Không gán store -> Mặc định dùng MemoryStore
    }
  } else {
    console.log("[Session] MongoDB not connected, using MemoryStore (Sessions will reset on restart)");
  }
  
  return session(sessionConfig);
}

export async function setupGoogleAuth(app: Express, mongoConnected: boolean) {
  // QUAN TRỌNG: Dòng này giúp Express nhận diện HTTPS từ Nginx
  app.set("trust proxy", 1);
  
  app.use(getSession(mongoConnected));
  app.use(passport.initialize());
  app.use(passport.session());

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.error("[GoogleAuth] Missing credentials");
    throw new Error("Google OAuth credentials not configured");
  }

  // --- SỬA LỖI URL ---
  // Ưu tiên dùng BASE_URL từ .env (VD: https://datald.com)
  // Nếu không có mới tự build (nhưng bỏ port đi nếu là production)
  const baseUrl = process.env.BASE_URL || (
    process.env.NODE_ENV === 'production' 
      ? `https://${process.env.HOST || 'localhost'}` 
      : `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 5000}`
  );
  
  const callbackURL = `${baseUrl}/api/auth/google/callback`;
  console.log(`[GoogleAuth] Callback URL configured: ${callbackURL}`);

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Logic xử lý user giữ nguyên
          const email = profile.emails?.[0]?.value || null;
          const firstName = profile.name?.givenName || null;
          const lastName = profile.name?.familyName || null;
          const profileImageUrl = profile.photos?.[0]?.value || null;

          // Lưu vào DB
          const user = await storage.upsertUser({
            id: profile.id,
            email,
            firstName,
            lastName,
            profileImageUrl,
          });

          // Tạo object session gọn nhẹ hơn
          const sessionUser = {
            id: profile.id, // Quan trọng nhất để serialize
            claims: {
              sub: profile.id,
              email,
              first_name: firstName,
              last_name: lastName,
              profile_image_url: profileImageUrl,
            },
            // Chỉ lưu token nếu thực sự cần dùng để gọi Google API sau này
            // access_token: accessToken, 
          };

          done(null, sessionUser);
        } catch (error) {
          console.error("[GoogleAuth] Error during authentication:", error);
          done(error as Error);
        }
      }
    )
  );

  // Serialize: Chỉ lưu ID hoặc object nhỏ gọn
  passport.serializeUser((user: any, cb) => {
    cb(null, user);
  });

  passport.deserializeUser((user: any, cb) => {
    cb(null, user);
  });

  app.get(
    "/api/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
    })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/?error=auth_failed",
    }),
    (req, res) => {
      // Login thành công -> Lưu session -> Redirect
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/");
      });
    }
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.redirect("/");
      });
    });
  });

  // Redirect /api/login to Google auth for backwards compatibility
  app.get("/api/login", (_req, res) => {
    res.redirect("/api/auth/google");
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
