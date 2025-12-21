/**
 * Environment variables loader
 * Loads environment variables from .env file
 * Must be imported FIRST before any other modules that use process.env
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory for ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
const envPath = resolve(__dirname, '..', '..', '.env');
const result = config({ path: envPath });

// Also try loading from current directory (for compatibility)
if (!result.parsed) {
  config();
}

// Validate required environment variables
const requiredEnvVars: string[] = [];

// Optional: Add validation for critical env vars in production
if (process.env.NODE_ENV === 'production') {
  // Add any production-required vars here
  // requiredEnvVars.push('DATABASE_URL', 'SESSION_SECRET');
}

// Check required variables
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error(`Please check your .env file or set these variables.`);
  // Don't exit in development to allow graceful degradation
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Log environment status (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log(`📝 Environment loaded from: ${envPath}`);
  console.log(`📝 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
}

export {};

