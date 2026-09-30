import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  BookOpen,
  ArrowLeft,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Archive,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  FileText,
} from 'lucide-react';
import {
  knowledgeAdminService,
  type KnowledgeSourceRow,
  type KnowledgeSourceDetail,
  type KnowledgeSourceType,
  type KnowledgeVisibility,
} from '../../services/knowledgeAdminService';

const CARD = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  published: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300',
  archived: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300',
};

const INDEXING_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  indexing: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
  indexed: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
};

const SOURCE_TYPES: KnowledgeSourceType[] = ['markdown', 'text', 'html'];

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; id: string };

function EmptyState({ icon: Icon, title, description }: { icon: React.FC<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="p-12 text-center space-y-3">
      <Icon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{description}</p>
    </div>
  );
}

/**
 * Content management for the AI Agent's knowledge base (search_knowledge /
 * RAG) — create, edit, publish/archive, and re-index a source. This is an
 * authorized APPLICATION operation gated by knowledge.manage, mirroring
 * src/server/ai/knowledgeAdminRouter.ts exactly; nothing here is reachable
 * by the LLM itself.
 */
export const KnowledgeBaseAdminView: React.FC = () => {
  const [sources, setSources] = useState<KnowledgeSourceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSourceType, setFormSourceType] = useState<KnowledgeSourceType>('markdown');
  const [formVisibility, setFormVisibility] = useState<KnowledgeVisibility>('internal');
  const [formContent, setFormContent] = useState('');
  const [formStatus, setFormStatus] = useState<KnowledgeSourceDetail['status'] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    setIsLoading(true);
    setListError(null);
    const result = await knowledgeAdminService.list();
    if (result.success) setSources(result.data ?? []);
    else setListError(result.error ?? 'Failed to load knowledge sources.');
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const openCreate = () => {
    setFormTitle('');
    setFormDescription('');
    setFormSourceType('markdown');
    setFormVisibility('internal');
    setFormContent('');
    setFormStatus(null);
    setSaveError(null);
    setSaveNotice(null);
    setMode({ kind: 'create' });
  };

  const openEdit = async (id: string) => {
    setMode({ kind: 'edit', id });
    setIsDetailLoading(true);
    setSaveError(null);
    setSaveNotice(null);
    const result = await knowledgeAdminService.get(id);
    setIsDetailLoading(false);
    if (!result.success || !result.data) {
      setSaveError(result.error ?? 'Failed to load this document.');
      return;
    }
    setFormTitle(result.data.title);
    setFormDescription(result.data.description ?? '');
    setFormSourceType(result.data.source_type);
    setFormVisibility(result.data.visibility);
    setFormContent(result.data.content);
    setFormStatus(result.data.status);
  };

  const backToList = () => {
    setMode({ kind: 'list' });
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      setSaveError('Title is required.');
      return;
    }
    if (!formContent.trim()) {
      setSaveError('Content is required.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      sourceType: formSourceType,
      visibility: formVisibility,
      content: formContent,
    };
    const result = mode.kind === 'edit' ? await knowledgeAdminService.update(mode.id, payload) : await knowledgeAdminService.create(payload);
    setIsSaving(false);
    if (!result.success || !result.data) {
      setSaveError(result.error ?? 'Failed to save.');
      return;
    }
    await loadSources();
    if (mode.kind === 'create') {
      // Land on the new document's editor rather than bouncing back to the
      // list — publish/reindex are the natural next steps right after
      // writing it.
      setFormStatus(result.data.status);
      setMode({ kind: 'edit', id: result.data.id });
      setSaveNotice('Saved as draft.');
    } else {
      setFormStatus(result.data.status);
      setSaveNotice('Saved.');
    }
  };

  const handlePublish = async () => {
    if (mode.kind !== 'edit') return;
    setIsSaving(true);
    setSaveError(null);
    const result = await knowledgeAdminService.publish(mode.id);
    setIsSaving(false);
    if (!result.success || !result.data) {
      setSaveError(result.error ?? 'Failed to publish.');
      return;
    }
    setFormStatus(result.data.status);
    setSaveNotice('Published — now searchable once indexed.');
    await loadSources();
  };

  const handleArchive = async () => {
    if (mode.kind !== 'edit') return;
    setIsSaving(true);
    setSaveError(null);
    const result = await knowledgeAdminService.archive(mode.id);
    setIsSaving(false);
    if (!result.success || !result.data) {
      setSaveError(result.error ?? 'Failed to archive.');
      return;
    }
    setFormStatus(result.data.status);
    setSaveNotice('Archived — no longer searchable.');
    await loadSources();
  };

  const handleReindex = async () => {
    if (mode.kind !== 'edit') return;
    setIsSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    const result = await knowledgeAdminService.reindex(mode.id);
    setIsSaving(false);
    if (!result.success || !result.data) {
      setSaveError(result.error ?? 'Reindex failed.');
      return;
    }
    setSaveNotice(`Indexed — ${result.data.chunkCount} chunk${result.data.chunkCount === 1 ? '' : 's'} generated.`);
    await loadSources();
  };

  const handleRowReindex = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionBusyId(id);
    await knowledgeAdminService.reindex(id);
    await loadSources();
    setActionBusyId(null);
  };

  if (mode.kind !== 'list') {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={backToList}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Back to knowledge base list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {mode.kind === 'create' ? 'New Knowledge Document' : 'Edit Knowledge Document'}
          </h2>
          {formStatus && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_BADGE[formStatus]}`}>
              {formStatus}
            </span>
          )}
        </div>

        {isDetailLoading ? (
          <div className={`${CARD} p-12 flex items-center justify-center`}>
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className={`${CARD} p-5 space-y-4`}>
            {saveError && (
              <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {saveError}
              </div>
            )}
            {saveNotice && !saveError && (
              <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {saveNotice}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Invoice Approval Workflow"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description (optional)</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Shown only in this admin list, not to the AI"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Format</label>
                <select
                  value={formSourceType}
                  onChange={(e) => setFormSourceType(e.target.value as KnowledgeSourceType)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Visibility</label>
                <select
                  value={formVisibility}
                  onChange={(e) => setFormVisibility(e.target.value as KnowledgeVisibility)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="internal">Internal — any user with knowledge.view</option>
                  <option value="restricted">Restricted — content admins only</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Content</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={16}
                placeholder="Write the document the AI Agent should be able to search and cite..."
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Saving a content change resets indexing — use Reindex below to make the update searchable.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>

              {mode.kind === 'edit' && (
                <>
                  {formStatus !== 'published' && (
                    <button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Publish
                    </button>
                  )}
                  {formStatus !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => void handleArchive()}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Archive
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleReindex()}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reindex
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Knowledge Base
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Documents Ask Artify can search and cite via search_knowledge. Only published, indexed documents are searchable.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Document
        </button>
      </div>

      {listError && (
        <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {listError}
        </div>
      )}

      <div className={CARD}>
        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : sources.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No knowledge documents yet"
            description="Add a document (a CAS workflow guide, policy, or how-to) so Ask Artify can search and cite it when answering knowledge questions."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sources.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void openEdit(s.id)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{s.title}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${STATUS_BADGE[s.status]}`}>
                      {s.status}
                    </span>
                    {s.visibility === 'restricted' && (
                      <span title="Restricted to content admins" className="shrink-0">
                        <EyeOff className="w-3 h-3 text-slate-400" />
                      </span>
                    )}
                    {s.visibility === 'internal' && (
                      <span title="Visible to any user with knowledge.view" className="shrink-0">
                        <Eye className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{s.description}</div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${INDEXING_BADGE[s.indexing_status]}`}>
                    {s.indexing_status}
                  </span>
                  {s.indexing_status !== 'indexing' && (
                    <button
                      type="button"
                      onClick={(e) => void handleRowReindex(s.id, e)}
                      disabled={actionBusyId === s.id}
                      title="Reindex"
                      aria-label={`Reindex ${s.title}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      {actionBusyId === s.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBaseAdminView;
