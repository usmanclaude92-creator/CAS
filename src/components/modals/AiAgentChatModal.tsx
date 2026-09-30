import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Bot,
  User,
  BookOpen,
  Mic,
  Square,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { aiChatService, type KnowledgeSourceCitation, type PendingAiActionSummary } from '../../services/aiChatService';
import { aiVoiceService } from '../../services/aiVoiceService';
import { aiAttachmentService, type UploadedAttachment } from '../../services/aiAttachmentService';
import { aiActionsService } from '../../services/aiActionsService';

interface MessageAttachmentSummary {
  fileName: string;
  kind: 'image' | 'document';
}

/** A proposed action attached to one assistant turn — see
 *  docs/ai/CAS-AI-PHASE-5.md §Confirmation protocol. `uiStatus` is purely
 *  client-side presentation state; the actual outcome always comes back
 *  from aiActionsService (the server), never assumed client-side. */
type PendingActionUiStatus = 'awaiting' | 'confirming' | 'rejecting' | 'completed' | 'failed' | 'rejected';
interface PendingActionUiState extends PendingAiActionSummary {
  uiStatus: PendingActionUiStatus;
  resultSummary?: string;
  errorMessage?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolActivity?: string[];
  isError?: boolean;
  /** Real provenance only, exactly as the server returned it — never
   *  fabricated here. Empty/omitted when the reply didn't use knowledge
   *  retrieval. */
  sources?: KnowledgeSourceCitation[];
  /** Cosmetic only (client-side) — what was attached to this user turn.
   *  The server only ever sees/acts on the attachment ids, not this list. */
  attachments?: MessageAttachmentSummary[];
  /** Set when this assistant turn proposed a medium/high-risk action still
   *  awaiting (or since resolved by) the user's explicit confirmation. */
  pendingAction?: PendingActionUiState;
}

interface AiAgentChatModalProps {
  onClose: () => void;
}

const CONVERSATION_STORAGE_KEY = 'cas.aiAgent.conversationId';
const MAX_MESSAGE_LENGTH = 4000;
const MAX_ATTACHMENTS_PER_MESSAGE = 3;
// Mirrors src/server/ai/voice/validation.ts's MAX_AUDIO_DURATION_SECONDS —
// a client-side UX cue only; the server is the actual authority and
// re-validates duration/size/format independently.
const MAX_RECORDING_SECONDS = 120;
const ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf';

type VoicePhase = 'idle' | 'recording' | 'transcribing' | 'error';

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

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** A short, generic human summary of an executed action's server-returned
 *  data — never fabricated, only ever describing fields the server itself
 *  sent back for this specific action. */
function summarizeActionResult(data: unknown): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.documentRef === 'string') return `Recorded as ${d.documentRef}.`;
    if (typeof d.title === 'string') return `"${d.title}" created.`;
    if (typeof d.name === 'string') return `${d.name} updated.`;
  }
  return 'Done.';
}

const RISK_BADGE_CLASSES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400',
};

/**
 * Professional enterprise-assistant chat popup — read-only, CAS-data-only.
 * Never renders a raw tool/internal name: tool activity is shown only as
 * the friendly labels the server already sends (see
 * src/server/ai/toolActivityLabels.ts), and error text is always the
 * server's own safe, category-mapped message (see docs/ai/CAS-AI-PHASE-2.md).
 *
 * Phase 4 adds voice (record -> transcribe -> review-and-send, never
 * auto-sent) and attachments (upload -> attach to the next message) as
 * additional input modalities, and per-reply text-to-speech playback.
 * Text remains the only required input path at every state — voice and
 * attachments are optional, never blocking.
 */
export const AiAgentChatModal: React.FC<AiAgentChatModalProps> = ({ onClose }) => {
  const [conversationId, setConversationId] = useState<string | undefined>(() => loadStoredConversationId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeActivity, setActiveActivity] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  // Voice (STT) state — Idle / Recording / Transcribing / Error, exactly the
  // states the Phase 4 directive calls for (Thinking/Speaking are covered by
  // isSending/speakingMessageId below).
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Text-to-speech playback state — at most one reply speaking at a time.
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  // Attachments pending on the NEXT outgoing message (temporary, per-request
  // — see src/server/ai/attachments/index.ts; never permanently indexed).
  const [pendingAttachments, setPendingAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasRestoredRef = useRef(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const recordingTimerRef = useRef<number | null>(null);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);

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

  const stopPlayback = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    setSpeakingMessageId(null);
  }, []);

  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const releaseMicrophone = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  // Clean up any in-flight recording/playback if the popup is closed mid-use.
  useEffect(() => {
    return () => {
      stopRecordingTimer();
      releaseMicrophone();
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    };
  }, [stopRecordingTimer, releaseMicrophone]);

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isSending) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      setLoadError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return;
    }

    const attachmentsForThisMessage = pendingAttachments;
    const attachmentIds = attachmentsForThisMessage.length > 0 ? attachmentsForThisMessage.map((a) => a.id) : undefined;

    setLoadError(null);
    setLastFailedMessage(null);
    setInput('');
    setPendingAttachments([]);
    setAttachmentError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'user',
        content: text,
        attachments: attachmentsForThisMessage.length > 0
          ? attachmentsForThisMessage.map((a) => ({ fileName: a.fileName, kind: a.kind }))
          : undefined,
      },
    ]);
    setIsSending(true);
    setActiveActivity('Thinking…');

    const result = await aiChatService.sendMessage(text, conversationId, attachmentIds);

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
        sources: result.sources,
        pendingAction: result.pendingAction ? { ...result.pendingAction, uiStatus: 'awaiting' } : undefined,
      },
    ]);
  };

  // --- Controlled actions (Phase 5) ---------------------------------------
  // The ONLY thing that can ever execute a medium/high-risk action is the
  // user clicking Confirm here, which calls the real confirm endpoint with
  // the server-generated confirmationId — never anything typed in chat.

  const updatePendingAction = (messageId: string, patch: Partial<PendingActionUiState>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.pendingAction ? { ...m, pendingAction: { ...m.pendingAction, ...patch } } : m))
    );
  };

  const handleConfirmAction = async (messageId: string, confirmationId: string) => {
    updatePendingAction(messageId, { uiStatus: 'confirming' });
    const result = await aiActionsService.confirm(confirmationId);
    if (result.success === false) {
      updatePendingAction(messageId, { uiStatus: 'failed', errorMessage: result.error });
      return;
    }
    updatePendingAction(messageId, { uiStatus: 'completed', resultSummary: summarizeActionResult(result.data) });
  };

  const handleRejectAction = async (messageId: string, confirmationId: string) => {
    updatePendingAction(messageId, { uiStatus: 'rejecting' });
    const result = await aiActionsService.reject(confirmationId);
    if (result.success === false) {
      updatePendingAction(messageId, { uiStatus: 'awaiting', errorMessage: result.error });
      return;
    }
    updatePendingAction(messageId, { uiStatus: 'rejected' });
  };

  const handleRetry = () => {
    if (lastFailedMessage) void handleSend(lastFailedMessage);
  };

  const handleNewConversation = () => {
    stopPlayback();
    setConversationId(undefined);
    storeConversationId(null);
    setMessages([]);
    setLoadError(null);
    setLastFailedMessage(null);
    setPendingAttachments([]);
    setAttachmentError(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // --- Attachments -----------------------------------------------------

  const handleAttachClick = () => {
    if (isUploadingAttachment || pendingAttachments.length >= MAX_ATTACHMENTS_PER_MESSAGE) return;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (pendingAttachments.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
      setAttachmentError(`You can attach at most ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
      return;
    }

    setAttachmentError(null);
    setIsUploadingAttachment(true);
    const result = await aiAttachmentService.upload(file);
    setIsUploadingAttachment(false);

    if (result.success === false) {
      setAttachmentError(result.error);
      return;
    }
    setPendingAttachments((prev) => [...prev, result.attachment]);
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // --- Voice input (STT) -------------------------------------------------
  // The transcript is placed into the text box for the user to review and
  // send — never sent automatically. This keeps voice as a convenience for
  // producing text, not a separate authority: the message that actually
  // reaches the server is the same typed-or-transcribed text either way.

  const startRecording = async () => {
    setVoiceError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoicePhase('error');
      setVoiceError('Voice recording is not supported in this browser. Please type your message instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingCancelledRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stopRecordingTimer();
        releaseMicrophone();
        const cancelled = recordingCancelledRef.current;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (cancelled || chunks.length === 0) {
          setVoicePhase('idle');
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        void transcribeRecording(blob);
      };

      recorder.start();
      setVoicePhase('recording');
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            mediaRecorderRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      setVoicePhase('error');
      setVoiceError('Microphone access was denied or unavailable. You can still type your message.');
    }
  };

  const stopRecording = () => {
    recordingCancelledRef.current = false;
    mediaRecorderRef.current?.stop();
  };

  const cancelRecording = () => {
    recordingCancelledRef.current = true;
    mediaRecorderRef.current?.stop();
  };

  const transcribeRecording = async (blob: Blob) => {
    setVoicePhase('transcribing');
    const result = await aiVoiceService.transcribe(blob);
    if (result.success === false) {
      setVoicePhase('error');
      setVoiceError(result.error);
      return;
    }
    setVoicePhase('idle');
    if (result.transcript.trim()) {
      setInput((prev) => (prev ? `${prev} ${result.transcript}` : result.transcript));
    }
    inputRef.current?.focus();
  };

  const handleMicClick = () => {
    if (voicePhase === 'recording') {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  // --- Text-to-speech playback --------------------------------------------

  const handleSpeak = async (message: ChatMessage) => {
    if (speakingMessageId === message.id) {
      stopPlayback();
      return;
    }
    stopPlayback();
    setTtsError(null);
    setSpeakingMessageId(message.id);
    const result = await aiVoiceService.synthesize(message.content);
    if (result.success === false) {
      setSpeakingMessageId(null);
      setTtsError(result.error);
      return;
    }
    audioObjectUrlRef.current = result.audioUrl;
    const audio = new Audio(result.audioUrl);
    audioPlayerRef.current = audio;
    audio.onended = () => stopPlayback();
    audio.onerror = () => {
      setTtsError('Could not play the generated speech.');
      stopPlayback();
    };
    void audio.play();
  };

  const micLabel =
    voicePhase === 'recording'
      ? `Stop recording (${formatSeconds(recordingSeconds)})`
      : voicePhase === 'transcribing'
      ? 'Transcribing…'
      : 'Record a voice message';

  return (
    <div
      className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 flex flex-col w-full h-full sm:w-96 sm:h-[560px] sm:max-h-[80vh] bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-2"
      role="dialog"
      aria-modal="true"
      aria-label="Ask Artify chat"
    >
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-600 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
            <img src="/ask-artify-logo.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">Ask Artify</div>
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
            aria-label="Close Ask Artify"
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
            <div className="w-12 h-12 rounded-2xl overflow-hidden mb-3">
              <img src="/ask-artify-logo.png" alt="" className="w-full h-full object-cover" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ask about your CAS data</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px]">
              e.g. &ldquo;What&rsquo;s the outstanding balance for Vendor ABC?&rdquo; Type, speak, or attach a photo/PDF — answers are limited to data you have permission to see.
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
            <div className="max-w-[80%] flex flex-col gap-1">
              {m.attachments && m.attachments.length > 0 && (
                <div className="flex flex-wrap justify-end gap-1">
                  {m.attachments.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-[10px] text-blue-700 dark:text-blue-300 max-w-[160px]"
                    >
                      {a.kind === 'image' ? <ImageIcon className="w-3 h-3 shrink-0" /> : <FileText className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{a.fileName}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-1">
                <div
                  className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
                {m.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => void handleSpeak(m)}
                    title={speakingMessageId === m.id ? 'Stop reading aloud' : 'Read this reply aloud'}
                    aria-label={speakingMessageId === m.id ? 'Stop reading this reply aloud' : 'Read this reply aloud'}
                    className="shrink-0 mb-0.5 p-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {speakingMessageId === m.id ? <VolumeX className="w-3.5 h-3.5 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              {/* Sources — only ever the real provenance the server
                  returned for this exact reply, never invented here. */}
              {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    <BookOpen className="w-3 h-3" />
                    Sources
                  </div>
                  <ul className="space-y-0.5">
                    {m.sources.map((s) => (
                      <li key={s.sourceId} className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                        {s.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action confirmation card — Phase 5. Every field here comes
                  straight from the server's own buildPreview() output
                  (see src/server/ai/actions/types.ts); nothing is inferred
                  from the model's text. */}
              {m.role === 'assistant' && m.pendingAction && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Action Requested</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${RISK_BADGE_CLASSES[m.pendingAction.riskLevel]}`}>
                      {m.pendingAction.riskLevel} risk
                    </span>
                  </div>
                  <div className="px-2.5 py-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">{m.pendingAction.preview.summary}</p>
                    <dl className="space-y-0.5">
                      {m.pendingAction.preview.fields.map((f, i) => (
                        <div key={i} className="flex gap-1.5 text-[11px]">
                          <dt className="text-slate-400 dark:text-slate-500 shrink-0">{f.label}:</dt>
                          <dd className="text-slate-700 dark:text-slate-200 truncate">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {m.pendingAction.preview.warnings?.map((w, i) => (
                      <p key={i} className="text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1">
                        <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </p>
                    ))}

                    {m.pendingAction.uiStatus === 'awaiting' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => void handleConfirmAction(m.id, m.pendingAction!.confirmationId)}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRejectAction(m.id, m.pendingAction!.confirmationId)}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-semibold cursor-pointer transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    )}
                    {(m.pendingAction.uiStatus === 'confirming' || m.pendingAction.uiStatus === 'rejecting') && (
                      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {m.pendingAction.uiStatus === 'confirming' ? 'Executing…' : 'Declining…'}
                      </div>
                    )}
                    {m.pendingAction.uiStatus === 'completed' && (
                      <div className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {m.pendingAction.resultSummary ?? 'Completed.'}
                      </div>
                    )}
                    {m.pendingAction.uiStatus === 'rejected' && (
                      <div className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <XCircle className="w-3.5 h-3.5" />
                        Declined — no changes were made.
                      </div>
                    )}
                    {m.pendingAction.uiStatus === 'failed' && (
                      <div className="space-y-0.5 pt-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {m.pendingAction.errorMessage ?? 'This action could not be completed.'}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">This confirmation can&rsquo;t be reused — ask again to propose it fresh.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

        {ttsError && (
          <div className="mx-1 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">{ttsError} The text reply above is still available.</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 p-2.5 bg-white dark:bg-slate-900 space-y-2">
        {/* Recording status strip — only shown while actively recording, so
            it never displaces the always-available text input below. */}
        {voicePhase === 'recording' && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Recording… {formatSeconds(recordingSeconds)} / {formatSeconds(MAX_RECORDING_SECONDS)}
            </div>
            <button
              type="button"
              onClick={cancelRecording}
              className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {voiceError && voicePhase === 'error' && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-[11px]">
            {voiceError}
          </div>
        )}

        {attachmentError && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-[11px]">
            {attachmentError}
          </div>
        )}

        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingAttachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 max-w-[180px]"
              >
                {a.kind === 'image' ? <ImageIcon className="w-3 h-3 shrink-0" /> : <FileText className="w-3 h-3 shrink-0" />}
                <span className="truncate">{a.fileName}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`Remove attachment ${a.fileName}`}
                  className="shrink-0 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            onChange={(e) => void handleFileSelected(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={isUploadingAttachment || pendingAttachments.length >= MAX_ATTACHMENTS_PER_MESSAGE}
            title="Attach an image or PDF"
            aria-label="Attach an image or PDF"
            className="shrink-0 w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
          >
            {isUploadingAttachment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleMicClick}
            disabled={voicePhase === 'transcribing'}
            title={micLabel}
            aria-label={micLabel}
            aria-pressed={voicePhase === 'recording'}
            className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              voicePhase === 'recording'
                ? 'bg-rose-600 border-rose-600 text-white hover:bg-rose-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {voicePhase === 'transcribing' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : voicePhase === 'recording' ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about balances, invoices, projects…"
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={isSending}
            aria-label="Message"
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
