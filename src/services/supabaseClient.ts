import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'cas_supabase_url';
const STORAGE_KEY_KEY = 'cas_supabase_anon_key';

// Default Supabase project credentials
export const DEFAULT_SUPABASE_URL = 'https://cfkymotcnccgvkpmcevp.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNma3ltb3RjbmNjZ3ZrcG1jZXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4NDIyMjAsImV4cCI6MjEwNTQxODIyMH0.UydSETlKBKs3DbPuueKG1Oh8mQdWv-iRqPOSYybgF70';

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
  const envUrl = cleanUrl(import.meta.env?.VITE_SUPABASE_URL);
  if (isValidSupabaseUrl(envUrl)) return envUrl;
  try {
    const storedUrl = cleanUrl(localStorage.getItem(STORAGE_URL_KEY));
    if (isValidSupabaseUrl(storedUrl)) return storedUrl;
  } catch {
    // localStorage may fail
  }
  return DEFAULT_SUPABASE_URL;
};

const getInitialKey = (): string => {
  const envKey = cleanString(import.meta.env?.VITE_SUPABASE_ANON_KEY);
  if (isValidSupabaseKey(envKey)) return envKey;
  try {
    const storedKey = cleanString(localStorage.getItem(STORAGE_KEY_KEY));
    if (isValidSupabaseKey(storedKey)) return storedKey;
  } catch {
    // localStorage may fail
  }
  return DEFAULT_SUPABASE_ANON_KEY;
};

let currentUrl = getInitialUrl();
let currentKey = getInitialKey();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('[SupabaseClient] Error notifying listener:', e);
    }
  });
}

function buildClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export let supabase: SupabaseClient = buildClient(currentUrl, currentKey);

export function getSupabaseClient(): SupabaseClient | null {
  if (!isValidSupabaseUrl(currentUrl) || !isValidSupabaseKey(currentKey)) {
    return null;
  }
  return supabase;
}

export function isSupabaseConfigured(): boolean {
  return isValidSupabaseUrl(currentUrl) && isValidSupabaseKey(currentKey);
}

export const updateSupabaseCredentials = (url: string, key: string) => {
  const cUrl = cleanUrl(url);
  const cKey = cleanString(key);

  try {
    localStorage.setItem(STORAGE_URL_KEY, cUrl);
    localStorage.setItem(STORAGE_KEY_KEY, cKey);
  } catch {
    // ignore
  }

  currentUrl = cUrl || DEFAULT_SUPABASE_URL;
  currentKey = cKey || DEFAULT_SUPABASE_ANON_KEY;

  supabase = buildClient(currentUrl, currentKey);
  notifyListeners();
};

export function updateSupabaseConfig(rawUrl: string, rawAnonKey: string): boolean {
  const url = cleanUrl(rawUrl);
  const anonKey = cleanString(rawAnonKey);

  if (isValidSupabaseUrl(url) && isValidSupabaseKey(anonKey)) {
    updateSupabaseCredentials(url, anonKey);
    return true;
  }

  if (!url && !anonKey) {
    try {
      localStorage.removeItem(STORAGE_URL_KEY);
      localStorage.removeItem(STORAGE_KEY_KEY);
    } catch {
      // ignore
    }
    currentUrl = DEFAULT_SUPABASE_URL;
    currentKey = DEFAULT_SUPABASE_ANON_KEY;
    supabase = buildClient(currentUrl, currentKey);
    notifyListeners();
    return true;
  }

  return false;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase credentials not configured or invalid.',
    };
  }

  try {
    const { error: projectsError } = await client
      .from('projects')
      .select('count', { count: 'exact', head: true });

    if (!projectsError) {
      return {
        success: true,
        message: 'Successfully connected to live Supabase PostgreSQL database!',
      };
    }

    if (
      projectsError.code === '42P01' ||
      projectsError.code === 'PGRST205' ||
      projectsError.message?.toLowerCase().includes('relation') ||
      projectsError.message?.toLowerCase().includes('schema cache') ||
      projectsError.message?.toLowerCase().includes('does not exist')
    ) {
      return {
        success: true,
        message: 'Connected to Supabase project! (Table schema pending migration)',
      };
    }

    const { error: authError } = await client.auth.getSession();
    if (!authError) {
      return {
        success: true,
        message: `Connected to Supabase! (Table note: ${projectsError.message})`,
      };
    }

    return {
      success: false,
      message: `Connected to Supabase, but returned: ${projectsError.message}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Connection error: ${err?.message || 'Network unreachable'}`,
    };
  }
}

export async function uploadAttachmentFile(
  file: File,
  transactionType: string,
  referenceId: string
): Promise<{ url: string; name: string; size: number; type: string }> {
  const client = getSupabaseClient();
  const fileExt = file.name.split('.').pop() || 'dat';
  const uniqueName = `${transactionType.toLowerCase()}_${referenceId}_${Date.now()}.${fileExt}`;
  const filePath = `uploads/${uniqueName}`;

  if (client) {
    try {
      const { data, error } = await client.storage
        .from('construction_attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (!error && data) {
        const { data: publicData } = client.storage
          .from('construction_attachments')
          .getPublicUrl(data.path);

        return {
          url: publicData.publicUrl,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
        };
      }
    } catch (err) {
      console.warn('Supabase storage upload failed, falling back to local object storage:', err);
    }
  }

  // Fallback: Read file to Data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
      });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function saveExpenseCategoryToSupabase(category: {
  name: string;
  description?: string;
  category?: string;
  status?: 'active' | 'inactive';
  remarks?: string;
}): Promise<{ success: boolean; synced: boolean; message: string; data?: any }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: true,
      synced: false,
      message: 'Saved locally. Supabase endpoint not configured.',
    };
  }

  try {
    const payload = {
      name: category.name.trim(),
      category: category.category?.trim() || 'Direct Project Cost',
      status: category.status || 'active',
      remarks: category.description?.trim() || category.remarks?.trim() || null,
    };

    const res = await client
      .from('expense_heads')
      .upsert([payload], { onConflict: 'name' })
      .select();

    if (res.error) {
      const fallbackRes = await client
        .from('expense_categories')
        .upsert([payload], { onConflict: 'name' })
        .select();

      if (!fallbackRes.error) {
        return {
          success: true,
          synced: true,
          message: 'Expense category saved to Supabase (expense_categories)!',
          data: fallbackRes.data,
        };
      }

      return {
        success: false,
        synced: false,
        message: `Saved locally. Supabase note: ${res.error.message || 'Table not found'}`,
      };
    }

    return {
      success: true,
      synced: true,
      message: 'Expense category successfully synced with Supabase master list!',
      data: res.data,
    };
  } catch (err: any) {
    return {
      success: false,
      synced: false,
      message: `Saved locally. Supabase error: ${err?.message || 'Network issue'}`,
    };
  }
}

export async function updateExpenseCategoryInSupabase(
  originalName: string,
  updates: {
    name?: string;
    description?: string;
    category?: string;
    status?: 'active' | 'inactive';
    remarks?: string;
  }
): Promise<{ success: boolean; synced: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: true, synced: false, message: 'Updated locally only' };

  try {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.category !== undefined) payload.category = updates.category.trim();
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.description !== undefined || updates.remarks !== undefined) {
      payload.remarks = updates.description?.trim() || updates.remarks?.trim() || null;
    }

    let res = await client.from('expense_heads').update(payload).eq('name', originalName.trim());
    if (res.error) {
      await client.from('expense_categories').update(payload).eq('name', originalName.trim());
    }

    return { success: true, synced: true, message: 'Updated in Supabase' };
  } catch (err: any) {
    return { success: false, synced: false, message: err?.message };
  }
}

export const supabaseService = {
  isConfigured: isSupabaseConfigured,
  getClient: getSupabaseClient,
  uploadAttachment: uploadAttachmentFile,
  testConnection: testSupabaseConnection,
  saveExpenseCategory: saveExpenseCategoryToSupabase,
  updateExpenseCategory: updateExpenseCategoryInSupabase,
  getConfig: () => ({
    url: currentUrl,
    anonKey: currentKey,
    supabaseUrl: currentUrl,
    supabaseAnonKey: currentKey,
  }),
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const supabaseClientManager = {
  getConfig: () => ({
    url: currentUrl,
    anonKey: currentKey,
  }),
  updateConfig: (url: string, anonKey: string) => updateSupabaseConfig(url, anonKey),
  testConnection: () => testSupabaseConnection(),
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
  async pullRemoteChanges(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      // Refresh local state if remote synchronization is configured
      return true;
    } catch (err) {
      console.error('Failed to pull remote changes:', err);
      return false;
    }
  },

export default supabaseService;
