import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'cas_supabase_url';
const STORAGE_KEY_KEY = 'cas_supabase_anon_key';

export interface UploadedAttachment {
  url: string;
  name: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error?: string;
}

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
    // ignore storage access errors
  }
  return (import.meta.env.VITE_SUPABASE_URL || '').trim();
};

const getStoredOrEnvKey = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_KEY);
    if (stored) return stored.trim();
  } catch {
    // ignore storage access errors
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

// Returns { url, name } as expected by all transaction modals
export const uploadAttachmentFile = async (
  file: File,
  transactionTypeOrFolder: string = 'attachments',
  referenceId?: string
): Promise<UploadedAttachment | null> => {
  try {
    const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured. Using local object URL.');
      return { url: URL.createObjectURL(file), name: file.name };
    }

    const client = getSupabaseClient();
    const folder = transactionTypeOrFolder || 'attachments';
    const filePath = referenceId
      ? `${folder}/${referenceId}/${cleanFileName}`
      : `${folder}/${cleanFileName}`;

    const { data, error } = await client.storage
      .from('attachments')
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.warn('Storage upload error, fallback to local URL:', error);
      return { url: URL.createObjectURL(file), name: file.name };
    }

    const { data: publicUrlData } = client.storage
      .from('attachments')
      .getPublicUrl(data.path);

    return {
      url: publicUrlData.publicUrl || data.path,
      name: file.name,
    };
  } catch (err) {
    console.error('Attachment upload failed:', err);
    return { url: URL.createObjectURL(file), name: file.name };
  }
};

// Expense Category APIs
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

// Supports both (id, category) and single-argument (category) signatures
export const updateExpenseCategoryInSupabase = async (
  idOrCategory: any,
  categoryData?: any
): Promise<any> => {
  try {
    if (!isSupabaseConfigured()) return categoryData || idOrCategory;
    const client = getSupabaseClient();
    const id = typeof idOrCategory === 'object' ? idOrCategory.id : idOrCategory;
    const payload = categoryData !== undefined
      ? categoryData
      : (typeof idOrCategory === 'object' ? idOrCategory : {});

    const { data, error } = await client
      .from('expense_categories')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data || payload;
  } catch (err) {
    console.error('Failed to update expense category in Supabase:', err);
    return categoryData || idOrCategory;
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

// Client Manager singleton
export const supabaseClientManager = {
  isConfigured: (): boolean => isSupabaseConfigured(),

  getClient: (): SupabaseClient => getSupabaseClient(),

  getConfig: () => {
    const url = getStoredOrEnvUrl();
    const key = getStoredOrEnvKey();
    return {
      url,
      key,
      supabaseUrl: url,
      anonKey: key,
      supabaseAnonKey: key,
    };
  },

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

  updateConfig: (url: string, key: string): void => {
    supabaseClientManager.saveConfig(url, key);
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

  testConnection: async (
    testUrl?: string,
    testKey?: string
  ): Promise<ConnectionTestResult> => {
    try {
      const urlToTest = testUrl || getStoredOrEnvUrl();
      const keyToTest = testKey || getStoredOrEnvKey();
      if (!urlToTest || !keyToTest || urlToTest.includes('placeholder.supabase.co')) {
        return {
          success: false,
          message: 'Supabase credentials are not configured.',
          error: 'Credentials missing',
        };
      }
      const client = createClientInstance(urlToTest, keyToTest);
      const { error } = await client.from('projects').select('id').limit(1);
      if (
        error &&
        error.message &&
        !error.message.includes('relation') &&
        !error.message.includes('does not exist')
      ) {
        return {
          success: false,
          message: error.message,
          error: error.message,
        };
      }
      return {
        success: true,
        message: 'Connected to Supabase successfully.',
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Connection test failed';
      return {
        success: false,
        message: errMsg,
        error: errMsg,
      };
    }
  },

  uploadAttachment: async (
    file: File,
    transactionType: string = 'attachments',
    referenceId?: string
  ): Promise<UploadedAttachment | null> => {
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
