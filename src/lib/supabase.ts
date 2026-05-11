import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

export const SUPABASE_CONFIGURED = Boolean(url && key);

if (!SUPABASE_CONFIGURED) {
  console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Dashboard will not fetch live data.');
}

export const supabase = SUPABASE_CONFIGURED ? createClient(url, key) : null as any;
