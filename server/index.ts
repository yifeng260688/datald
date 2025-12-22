// IMPORTANT: Load environment variables FIRST before any other imports
// Manually parse .env file to avoid ESM import issues with dotenv
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Load .env file manually
function loadEnv() {
  const envPath = resolve(projectRoot, '.env');
  
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (trimmed && !trimmed.startsWith('#')) {
          const equalIndex = trimmed.indexOf('=');
          if (equalIndex > 0) {
            const key = trimmed.substring(0, equalIndex).trim();
            let value = trimmed.substring(equalIndex + 1).trim();
            
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            
            // Only set if not already set (allow system env vars to override)
            if (key && !process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📝 Environment loaded from: ${envPath}`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load .env file: ${error}`);
    }
  } else {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`ℹ️  No .env file found at: ${envPath}`);
    }
  }
}

// Load environment synchronously before other imports
loadEnv();

// Log environment status (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log(`📝 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
}

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Create HTTP server immediately - before any async operations
const server = createServer(app);

// CRITICAL: Health check endpoints MUST be first - before ANY middleware
// These respond instantly (<10ms) for deployment health checks
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// Root health check for production - responds instantly for non-browsers
if (isProduction) {
  app.get('/', (req, res, next) => {
    const accept = req.headers.accept || '';
    const userAgent = req.headers['user-agent'] || '';
    
    // Real browsers send Accept: text/html AND have Mozilla/Chrome/Safari in UA
    const isBrowser = accept.includes('text/html') && 
                      (userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari'));
    
    if (!isBrowser) {
      return res.status(200).send('OK');
    }
    next();
  });
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Serve uploaded files and pipeline outputs
app.use('/uploads', express.static('uploads'));
app.use('/User-Upload', express.static('User-Upload'));
app.use('/Admin-Upload', express.static('Admin-Upload'));
app.use('/Category-Logos', express.static('Category-Logos'));

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// In production, set up static file serving SYNCHRONOUSLY before server starts
// This ensures "/" has a handler ready immediately
if (isProduction) {
  const distPath = path.resolve(import.meta.dirname, "public");
  
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    
    // Catch-all for SPA routing - but only for HTML requests
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
      return next();
      }
      const accept = req.headers.accept || '';
      if (accept.includes('text/html')) {
        res.sendFile(path.resolve(distPath, "index.html"));
      } else {
        next();
      }
    });
    
    log("Static files configured from: " + distPath);
  } else {
    log("Warning: Build directory not found at: " + distPath);
  }
}

// Start server IMMEDIATELY - before any database connections
// This ensures health checks pass while MongoDB connects in background
const port = parseInt(process.env.PORT || '5000', 10);
const host = process.env.HOST || 'localhost';

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${port} is already in use. Please stop the other process or use a different port.\n`);
    process.exit(1);
  } else {
    console.error(`\n❌ Server error: ${err.message}\n`);
    throw err;
  }
});

server.listen(port, host, () => {
  const previewUrl = `http://${host}:${port}`;
  log(`✅ Server started successfully!`);
  log(`🌐 Preview available at: ${previewUrl}`);
  log(`📱 Alternative: http://127.0.0.1:${port}`);
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 PREVIEW READY: ${previewUrl}`);
  console.log('='.repeat(60) + '\n');
  
  // AFTER server is listening, initialize everything else asynchronously
  initializeApp();
});

/ --- THÊM DÒNG NÀY ĐỂ TĂNG TIMEOUT NODEJS ---
server.timeout = 1200000;

async function initializeApp() {
  try {
    log("Initializing application...");
    
    // In development, setup Vite FIRST - before routes
    // This ensures the frontend is served correctly
    if (!isProduction) {
      log("Setting up Vite dev server...");
      await setupVite(app, server);
      log("✅ Vite dev server ready");
    }
    
    // Dynamic import to defer loading until after server starts
    const { registerRoutes } = await import("./routes");
    
    // Register all API routes (this connects to MongoDB)
    log("Registering routes...");
    await registerRoutes(app, server);
    log("✅ Routes registered");

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      console.error(err);
    });
    
    log("✅ Application fully initialized");
    console.log('\n' + '='.repeat(60));
    console.log('✨ All systems ready! You can now use the preview.');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error("\n❌ Failed to initialize application:", error);
    console.error("Server is still running for health checks, but some features may not work.\n");
    // Don't exit - keep serving health checks
  }
}
