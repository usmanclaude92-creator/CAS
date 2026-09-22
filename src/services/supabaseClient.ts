import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'cas_supabase_url';
const STORAGE_KEY_KEY = 'cas_supabase_anon_key';

let listeners: Array<() => void> = [];

const notifyListeners = () => {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Error invoking Supabase listener:', e);
    }
  });
};

const getStoredOrEnvUrl = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_URL);
    if (stored) return stored.trim();
  } catch {
    // ignore local storage errors
  }
  return (import.meta.env.VITE_SUPABASE_URL || '').trim();
};

const getStoredOrEnvKey = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_KEY);
    if (stored) return stored.trim();
  } catch {
    // ignore local storage errors
  }
  return (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
};

export const isSupabaseConfigured = (): boolean => {
  const url = getStoredOrEnvUrl();
  const key = getStoredOrEnvKey();
  return Boolean(url && key && !url.includes('placeholder.supabase.co'));
};

const createClientInstance = (url?: string, key?: string): SupabaseClient => {
  const finalUrl = (url || getStoredOrEnvUrl()) || 'https://placeholder.supabase.co';
  const finalKey = (key || getStoredOrEnvKey()) || 'placeholder-key';

  try {
    return createClient(finalUrl, finalKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (error) {
    console.warn('Fallback to dummy Supabase client:', error);
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
};

let currentClient: SupabaseClient = createClientInstance();

export const supabase = currentClient;

export const getSupabaseClient = (): SupabaseClient => {
  return currentClient;
};

// Upload attachment utility used across transaction modals
export const uploadAttachmentFile = async (
  file: File,
  transactionTypeOrFolder: string = 'attachments',
  referenceId?: string
): Promise<string | null> => {
  try {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured. Using local object URL.');
      return URL.createObjectURL(file);
    }

    const client = getSupabaseClient();
    const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const folder = transactionTypeOrFolder || 'attachments';
    const filePath = referenceId
      ? `${folder}/${referenceId}/${cleanFileName}`
      : `${folder}/${cleanFileName}`;

    const { data, error } = await client.storage
      .from('attachments')
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.warn('Storage upload error, fallback to local URL:', error);
      return URL.createObjectURL(file);
    }

    const { data: publicUrlData } = client.storage
      .from('attachments')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl || data.path;
  } catch (err) {
    console.error('Attachment upload failed:', err);
    return URL.createObjectURL(file);
  }
};

// Expense Category API operations
export const saveExpenseCategoryToSupabase = async (category: any): Promise<any> => {
  try {
    if (!isSupabaseConfigured()) return category;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('expense_categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data || category;
  } catch (err) {
    console.error('Failed to save expense category to Supabase:', err);
    return category;
  }
};

export const updateExpenseCategoryInSupabase = async (category: any): Promise<any> => {
  try {
    if (!isSupabaseConfigured()) return category;
    const client = getSupabaseClient();
    const id = typeof category === 'object' ? category.id : category;
    const payload = typeof category === 'object' ? category : {};

    const { data, error } = await client
      .from('expense_categories')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data || category;
  } catch (err) {
    console.error('Failed to update expense category in Supabase:', err);
    return category;
  }
};

export const deleteExpenseCategoryFromSupabase = async (id: string): Promise<boolean> => {
  try {
    if (!isSupabaseConfigured()) return true;
    const client = getSupabaseClient();
    const { error } = await client
      .from('expense_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to delete expense category from Supabase:', err);
    return false;
  }
};

// Client Manager singleton used by App.tsx and SupabaseSettingsModal
export const supabaseClientManager = {
  isConfigured: (): boolean => isSupabaseConfigured(),

  getClient: (): SupabaseClient => getSupabaseClient(),

  getConfig: () => ({
    url: getStoredOrEnvUrl(),
    key: getStoredOrEnvKey(),
  }),

  saveConfig: (url: string, key: string): void => {
    try {
      localStorage.setItem(STORAGE_KEY_URL, url.trim());
      localStorage.setItem(STORAGE_KEY_KEY, key.trim());
      currentClient = createClientInstance(url.trim(), key.trim());
      notifyListeners();
    } catch (e) {
      console.error('Failed to save Supabase settings:', e);
    }
  },

  resetConfig: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_KEY);
      currentClient = createClientInstance();
      notifyListeners();
    } catch (e) {
      console.error('Failed to reset Supabase settings:', e);
    }
  },

  uploadAttachment: async (
    file: File,
    transactionType: string,
    referenceId: string
  ): Promise<string | null> => {
    return uploadAttachmentFile(file, transactionType, referenceId);
  },

  pullRemoteChanges: async (): Promise<any> => {
    try {
      if (!isSupabaseConfigured()) return null;
      console.log('Pulling remote changes from Supabase...');
      return null;
    } catch (err) {
      console.warn('Error pulling remote changes:', err);
      return null;
    }
  },

  subscribe: (fn: () => void): (() => boolean) => {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
      return true;
    };
  },
};

export const supabaseService = supabaseClientManager;
export default supabaseClientManager;
