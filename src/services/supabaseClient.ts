import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'cas_supabase_url';
const STORAGE_KEY_KEY = 'cas_supabase_anon_key';

// Default Supabase project credentials
const DEFAULT_SUPABASE_URL = 'https://psimeuwxwwozfyjklzvg.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzaW1ldXd4d3dvemZ5amtsenZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NzY3MTEsImV4cCI6MjEwNTI1MjcxMX0.LVC9rCB7-d6cETh37FudqxACikSQQiF6DX05EXeVx9s';

function cleanString(val?: unknown): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

function cleanUrl(val?: unknown): string {
  const cleaned = cleanString(val);
  return cleaned.replace(/\/+$/, '');
}

export const isValidSupabaseUrl = (url?: string): boolean => {
  const cleaned = cleanUrl(url);
  return Boolean(
    cleaned &&
    cleaned.startsWith('http') &&
    !cleaned.includes('your-project.supabase.co') &&
    !cleaned.includes('your-project-id')
  );
};

export const isValidSupabaseKey = (key?: string): boolean => {
  const cleaned = cleanString(key);
  return Boolean(
    cleaned &&
    cleaned.length > 20 &&
    !cleaned.includes('your-anon-key')
  );
};

const getInitialUrl = (): string => {
  const envUrl = cleanUrl(import.meta.env.VITE_SUPABASE_URL);
  if (isValidSupabaseUrl(envUrl)) return envUrl;
  const storedUrl = cleanUrl(localStorage.getItem(STORAGE_URL_KEY));
  if (isValidSupabaseUrl(storedUrl)) return storedUrl;
  return DEFAULT_SUPABASE_URL;
};

const getInitialKey = (): string => {
  const envKey = cleanString(import.meta.env.VITE_SUPABASE_ANON_KEY);
  if (isValidSupabaseKey(envKey)) return envKey;
  const storedKey = cleanString(localStorage.getItem(STORAGE_KEY_KEY));
  if (isValidSupabaseKey(storedKey)) return storedKey;
  return DEFAULT_SUPABASE_ANON_KEY;
};

let currentUrl = getInitialUrl();
let currentKey = getInitialKey();

export let supabase: SupabaseClient = createClient(currentUrl, currentKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const updateSupabaseCredentials = (url: string, key: string) => {
  const cUrl = cleanUrl(url);
  const cKey = cleanString(key);

  localStorage.setItem(STORAGE_URL_KEY, cUrl);
  localStorage.setItem(STORAGE_KEY_KEY, cKey);

  currentUrl = cUrl;
  currentKey = cKey;

  supabase = createClient(currentUrl, currentKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};
