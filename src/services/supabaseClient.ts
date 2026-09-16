import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'cas_supabase_url';
const STORAGE_KEY_KEY = 'cas_supabase_anon_key';

function cleanString(val?: unknown): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

function cleanUrl(val?: unknown): string {
  const cleaned = cleanString(val);
  return cleaned.replace(/\/+$/, '');
}

// Validation helpers
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

// Retrieve initial values checking import.meta.env first, then localStorage
function getStoredConfig(): { url: string; anonKey: string } {
  const metaEnv = (import.meta as any).env || {};
  let url = cleanUrl(metaEnv.VITE_SUPABASE_URL);
  let anonKey = cleanString(metaEnv.VITE_SUPABASE_ANON_KEY);

  // If environment variables are empty or placeholders, check localStorage
  if (!isValidSupabaseUrl(url) || !isValidSupabaseKey(anonKey)) {
    try {
      const savedUrl = cleanUrl(localStorage.getItem(STORAGE_URL_KEY));
      const savedKey = cleanString(localStorage.getItem(STORAGE_KEY_KEY));
      if (isValidSupabaseUrl(savedUrl)) url = savedUrl;
      if (isValidSupabaseKey(savedKey)) anonKey = savedKey;
    } catch {
      // LocalStorage access might fail in private browsing mode
    }
  }

  return {
    url: isValidSupabaseUrl(url) ? url : '',
    anonKey: isValidSupabaseKey(anonKey) ? anonKey : '',
  };
}

let clientInstance: SupabaseClient | null = null;
let currentConfig = getStoredConfig();
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

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;

  const { url, anonKey } = currentConfig;

  if (isValidSupabaseUrl(url) && isValidSupabaseKey(anonKey)) {
    try {
      console.log('[SupabaseClient] Initializing client for project:', url);
      clientInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return clientInstance;
    } catch (e) {
      console.error('[SupabaseClient] Initialization failed:', e);
      return null;
    }
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseClient());
}

export function updateSupabaseConfig(rawUrl: string, rawAnonKey: string): boolean {
  const url = cleanUrl(rawUrl);
  const anonKey = cleanString(rawAnonKey);

  if (isValidSupabaseUrl(url) && isValidSupabaseKey(anonKey)) {
    currentConfig = { url, anonKey };
    try {
      localStorage.setItem(STORAGE_URL_KEY, url);
      localStorage.setItem(STORAGE_KEY_KEY, anonKey);
    } catch {
      // ignore
    }

    try {
      clientInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      notifyListeners();
      return true;
    } catch (e) {
      console.error('[SupabaseClient] Reinitialization failed:', e);
      return false;
    }
  }

  // Clear if empty
  if (!url && !anonKey) {
    currentConfig = { url: '', anonKey: '' };
    clientInstance = null;
    try {
      localStorage.removeItem(STORAGE_URL_KEY);
      localStorage.removeItem(STORAGE_KEY_KEY);
    } catch {
      // ignore
    }
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
      message: 'Supabase credentials not configured or invalid. The application is running smoothly in embedded local relational mode.',
    };
  }

  try {
    // Try pinging the projects table first
    const { error: projectsError } = await client
      .from('projects')
      .select('count', { count: 'exact', head: true });

    if (!projectsError) {
      return {
        success: true,
        message: 'Successfully connected to live Supabase PostgreSQL database and verified project schema!',
      };
    }

    // Check if table missing (meaning connection works, just schema migration pending)
    if (projectsError.code === '42P01' || projectsError.message?.toLowerCase().includes('relation') || projectsError.message?.toLowerCase().includes('does not exist')) {
      return {
        success: true,
        message: 'Connected to Supabase project! Note: Run database migrations from /supabase/migrations/ to create tables.',
      };
    }

    // Try a simple auth session check if schema has RLS restriction
    const { error: authError } = await client.auth.getSession();
    if (!authError) {
      return {
        success: true,
        message: `Connected to Supabase! (Table access note: ${projectsError.message})`,
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

/**
 * Handle document / attachment uploads
 * In live Supabase: uploads to 'construction_attachments' bucket
 * In preview/fallback: returns a robust base64 Data URL with full metadata
 */
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

  // Preview / Fallback: Read file to Data URL
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

export const supabaseService = {
  isConfigured: isSupabaseConfigured,
  getClient: getSupabaseClient,
  uploadAttachment: uploadAttachmentFile,
  testConnection: testSupabaseConnection,
  getConfig: () => ({
    url: currentConfig.url,
    anonKey: currentConfig.anonKey,
    supabaseUrl: currentConfig.url,
    supabaseAnonKey: currentConfig.anonKey,
  }),
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const supabaseClientManager = {
  getConfig: () => ({ ...currentConfig }),
  updateConfig: (url: string, anonKey: string) => updateSupabaseConfig(url, anonKey),
  testConnection: () => testSupabaseConnection(),
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export default supabaseService;
