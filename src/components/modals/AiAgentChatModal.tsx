import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, AlertTriangle, RotateCcw, Bot, User } from 'lucide-react';
import { aiChatService } from '../../services/aiChatService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolActivity?: string[];
  isError?: boolean;
}

interface AiAgentChatModalProps {
  onClose: () => void;
}

const CONVERSATION_STORAGE_KEY = 'cas.aiAgent.conversationId';
const MAX_MESSAGE_LENGTH = 4000;

function loadStoredConversationId(): string | undefined {
  try {
    return sessionStorage.getItem(CONVERSATION_STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function storeConversationId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(CONVERSATION_STORAGE_KEY, id);
    else sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
  } catch {
    // Best-effort only — an in-memory-only conversation still works fine
    // for the rest of this session if sessionStorage is unavailable
    // (private browsing, storage quota, etc.).
  }
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `m${idCounter}`;
}

/**
 * Professional enterprise-assistant chat popup — read-only, CAS-data-only.
 * Never renders a raw tool/internal name: tool activity is shown only as
 * the friendly labels the server already sends (see
 * src/server/ai/toolActivityLabels.ts), and error text is always the
 * server's own safe, category-mapped message (see docs/ai/CAS-AI-PHASE-2.md).
 */
export const AiAgentChatModal: React.FC<AiAgentChatModalProps> = ({ onClose }) => {
  const [conversationId, setConversationId] = useState<string | undefined>(() => loadStoredConversationId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeActivity, setActiveActivity] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasRestoredRef = useRef(false);

  // Restore prior history for a conversation carried over from an earlier
  // page load in this tab. If it's gone or no longer this user's (RLS), the
  // server just returns 404 and we quietly start fresh.
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    if (!conversationId) return;
    aiChatService.getConversationMessages(conversationId).then((history) => {
      if (!history) {
        setConversationId(undefined);
        storeConversationId(null);
        return;
      }
      setMessages(history.map((m) => ({ id: nextId(), role: m.role, content: m.content })));
    });
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, activeActivity]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isSending) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      setLoadError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return;
    }

    setLoadError(null);
    setLastFailedMessage(null);
    setInput('');
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsSending(true);
    setActiveActivity('Thinking…');

    const result = await aiChatService.sendMessage(text, conversationId);

    setIsSending(false);
    setActiveActivity(null);

    if (result.success === false) {
      setLoadError(result.error);
      setLastFailedMessage(text);
      return;
    }

    if (!conversationId) {
      setConversationId(result.conversationId);
      storeConversationId(result.conversationId);
    }
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'assistant',
        content: result.reply,
        toolActivity: result.toolActivity.map((t) => t.label),
      },
    ]);
  };

  const handleRetry = () => {
    if (lastFailedMessage) void handleSend(lastFailedMessage);
  };

  const handleNewConversation = () => {
    setConversationId(undefined);
    storeConversationId(null);
    setMessages([]);
    setLoadError(null);
    setLastFailedMessage(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 flex flex-col w-full h-full sm:w-96 sm:h-[560px] sm:max-h-[80vh] bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-2"
      role="dialog"
      aria-modal="true"
      aria-label="CAS AI Agent chat"
    >
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-600 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">CAS AI Agent</div>
            <div className="text-[10px] text-emerald-100 truncate">Read-only · answers from your CAS data</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleNewConversation}
            title="Start a new conversation"
            aria-label="Start a new conversation"
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close AI Agent"
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 bg-slate-50 dark:bg-slate-950/40">
        {messages.length === 0 && !isSending && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ask about your CAS data</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px]">
              e.g. &ldquo;What&rsquo;s the outstanding balance for Vendor ABC?&rdquo; Answers are limited to data you have permission to see.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
              }`}
            >
              {m.content}
            </div>
            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{activeActivity ?? 'Thinking…'}</span>
            </div>
          </div>
        )}

        {loadError && (
          <div className="mx-1 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div>{loadError}</div>
              {lastFailedMessage && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="mt-1.5 inline-flex items-center gap-1 font-semibold text-rose-800 dark:text-rose-200 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 p-2.5 bg-white dark:bg-slate-900">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about balances, invoices, projects…"
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={isSending}
            className="flex-1 resize-none max-h-24 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isSending || !input.trim()}
            aria-label="Send message"
            className="shrink-0 w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiAgentChatModal;
