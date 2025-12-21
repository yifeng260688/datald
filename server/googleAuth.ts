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
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const sessionStore = createSessionStore(mongoConnected);
  const isProduction = process.env.NODE_ENV === 'production';
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction, // Only use secure cookies in production (HTTPS)
      sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site in production, 'lax' for development
      maxAge: sessionTtl,
    },
  });
}

export async function setupGoogleAuth(app: Express, mongoConnected: boolean) {
  app.set("trust proxy", 1);
  app.use(getSession(mongoConnected));
  app.use(passport.initialize());
  app.use(passport.session());

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.error("[GoogleAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    throw new Error("Google OAuth credentials not configured");
  }

  // Build callback URL dynamically based on environment
  const port = process.env.PORT || '5000';
  const host = process.env.HOST || 'localhost';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  
  // Use GOOGLE_CALLBACK_URL if set, otherwise build from current config
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || 
    `${protocol}://${host}:${port}/api/auth/google/callback`;

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
          const email = profile.emails?.[0]?.value || null;
          const firstName = profile.name?.givenName || null;
          const lastName = profile.name?.familyName || null;
          const profileImageUrl = profile.photos?.[0]?.value || null;

          console.log("[GoogleAuth] User logged in:", {
            id: profile.id,
            email,
            firstName,
            lastName,
          });

          const user = await storage.upsertUser({
            id: profile.id,
            email,
            firstName,
            lastName,
            profileImageUrl,
          });

          const sessionUser = {
            claims: {
              sub: profile.id,
              email,
              first_name: firstName,
              last_name: lastName,
              profile_image_url: profileImageUrl,
            },
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          };

          done(null, sessionUser);
        } catch (error) {
          console.error("[GoogleAuth] Error during authentication:", error);
          done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

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
      res.redirect("/");
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
  const user = req.user as any;

  if (!req.isAuthenticated() || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
};
