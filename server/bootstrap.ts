
// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
import path from 'path';

// Always load base .env if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// If running in development, also load .env.development to override values
if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.development'), override: true });
}

// Verify critical environment variables are loaded
console.log('🔍 Environment check:', {
  SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: !!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: !!process.env.DATABASE_URL,
});

// Now import the server
import './index';
