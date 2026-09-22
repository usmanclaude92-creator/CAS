import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseUrl !== 'https://your-project-id.supabase.co'
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export interface SupabaseServiceType {
  isConfigured: () => boolean;
  getClient: () => SupabaseClient | any;
  testConnection: () => Promise<boolean>;
  uploadAttachment: (file: File, transactionType: string, referenceId: string) => Promise<string | null>;
  downloadAttachment: (path: string) => Promise<Blob | null>;
  deleteAttachment: (path: string) => Promise<boolean>;
  getAttachmentUrl: (path: string) => string;
  pullRemoteChanges: () => Promise<boolean>;
  pushLocalChanges: (data?: any) => Promise<boolean>;
  syncData: () => Promise<boolean>;
  subscribe: (fn: () => void) => () => boolean;
  [key: string]: any;
}

export const supabaseService: SupabaseServiceType = {
  isConfigured(): boolean {
    return isSupabaseConfigured();
  },

  getClient(): SupabaseClient | null {
    return supabase;
  },

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured() || !supabase) return false;
    try {
      const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      return !error;
    } catch (err) {
      console.warn('Supabase test connection failed:', err);
      return false;
    }
  },

  async uploadAttachment(file: File, transactionType: string, referenceId: string): Promise<string | null> {
    if (!this.isConfigured() || !supabase) {
      console.warn('Supabase is not configured. Attachment saved locally only.');
      return null;
    }

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${transactionType}/${referenceId}_${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error('Error uploading file to Supabase:', error.message);
        return null;
      }

      return data?.path || fileName;
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      return null;
    }
  },

  async downloadAttachment(path: string): Promise<Blob | null> {
    if (!this.isConfigured() || !supabase) return null;
    try {
      const { data, error } = await supabase.storage.from('attachments').download(path);
      if (error) {
        console.error('Error downloading attachment:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Failed to download attachment:', err);
      return null;
    }
  },

  async deleteAttachment(path: string): Promise<boolean> {
    if (!this.isConfigured() || !supabase) return false;
    try {
      const { error } = await supabase.storage.from('attachments').remove([path]);
      if (error) {
        console.error('Error deleting attachment:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      return false;
    }
  },

  getAttachmentUrl(path: string): string {
    if (!this.isConfigured() || !supabase) return '';
    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
    return data?.publicUrl || '';
  },

  async pullRemoteChanges(): Promise<boolean> {
    if (!this.isConfigured() || !supabase) return false;
    try {
      // Synchronize remote data if remote tables exist
      return true;
    } catch (err) {
      console.error('Failed to pull remote changes:', err);
      return false;
    }
  },

  async pushLocalChanges(_data?: any): Promise<boolean> {
    if (!this.isConfigured() || !supabase) return false;
    try {
      return true;
    } catch (err) {
      console.error('Failed to push local changes:', err);
      return false;
    }
  },

  async syncData(): Promise<boolean> {
    const pulled = await this.pullRemoteChanges();
    const pushed = await this.pushLocalChanges();
    return pulled && pushed;
  },

  subscribe(fn: () => void): () => boolean {
    if (!this.isConfigured() || !supabase) {
      return () => true;
    }

    try {
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          () => {
            fn();
          }
        )
        .subscribe();

      return () => {
        supabase?.removeChannel(channel);
        return true;
      };
    } catch (err) {
      console.warn('Supabase subscribe error:', err);
      return () => true;
    }
  },
};

export default supabaseService;
