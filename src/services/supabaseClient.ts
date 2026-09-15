import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const metaEnv = (import.meta as any).env || {};
const envUrl: string = metaEnv.VITE_SUPABASE_URL || '';
const envAnonKey: string = metaEnv.VITE_SUPABASE_ANON_KEY || '';

// Check if valid URL & Key
const isValidUrl = (url?: string) =>
  Boolean(url && url.startsWith('http') && !url.includes('your-project.supabase.co'));
const isValidKey = (key?: string) =>
  Boolean(key && key.length > 20 && !key.includes('your-anon-key'));

let clientInstance: SupabaseClient | null = null;
let customConfig = {
  url: isValidUrl(envUrl) ? envUrl : '',
  anonKey: isValidKey(envAnonKey) ? envAnonKey : '',
};

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;

  const url = customConfig.url || envUrl;
  const anonKey = customConfig.anonKey || envAnonKey;

  if (isValidUrl(url) && isValidKey(anonKey)) {
    try {
      console.log('[SupabaseClient] Initializing Supabase cloud client with URL:', url);
      clientInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      console.log('[SupabaseClient] Supabase client initialized successfully.');
      return clientInstance;
    } catch (e) {
      console.error('[SupabaseClient] Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseClient());
}

export function updateSupabaseConfig(url: string, anonKey: string): boolean {
  if (isValidUrl(url) && isValidKey(anonKey)) {
    customConfig = { url, anonKey };
    try {
      clientInstance = createClient(url, anonKey);
      return true;
    } catch (e) {
      console.error('Failed to reinitialize Supabase client:', e);
      return false;
    }
  }
  return false;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase credentials not configured or invalid. Running in embedded relational mode.',
    };
  }

  try {
    const { data, error } = await client.from('projects').select('count', { count: 'exact', head: true });
    if (error) {
      return { success: false, message: `Connected to Supabase, but query returned: ${error.message}` };
    }
    return { success: true, message: 'Successfully connected to live Supabase PostgreSQL database!' };
  } catch (err: any) {
    return { success: false, message: `Connection error: ${err?.message || 'Unknown network error'}` };
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
  const fileExt = file.name.split('.').pop();
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
};

export const supabaseClientManager = {
  getConfig: () => ({ ...customConfig }),
  updateConfig: (url: string, anonKey: string) => updateSupabaseConfig(url, anonKey),
  testConnection: () => testSupabaseConnection(),
};

export default supabaseService;

