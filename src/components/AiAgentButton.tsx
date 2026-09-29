import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AiAgentChatModal } from './modals/AiAgentChatModal';

/**
 * The header entry point into the read-only CAS AI Agent (Phase 2). A
 * round, filled accent button — deliberately distinct in shape from the
 * app's other rectangular header controls, so it reads as "assistant," not
 * another data-view shortcut. Shown to every authenticated user: even a
 * caller with no tool permissions still gets an honest answer from the
 * agent (see docs/ai/CAS-AI-PHASE-2.md's system prompt), never a dead end.
 */
export const AiAgentButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open CAS AI Agent"
        title="CAS AI Agent"
        className="relative w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
      </button>
      {isOpen && <AiAgentChatModal onClose={() => setIsOpen(false)} />}
    </>
  );
};

export default AiAgentButton;
