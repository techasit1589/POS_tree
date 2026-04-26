import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // ผิดพลาดตั้งแต่ start ดีกว่าได้ error งง ๆ ตอน fetch
  throw new Error(
    'Missing Supabase env vars. ตั้ง VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน .env / Vercel',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
