import React, { useState } from 'react';
import { AiAgentChatModal } from './modals/AiAgentChatModal';

/**
 * The header entry point into the read-only Ask Artify assistant (Phase 2).
 * A round, logo-badged button — deliberately distinct in shape from the
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
        aria-label="Open Ask Artify"
        title="Ask Artify"
        className="relative w-9 h-9 rounded-full overflow-hidden shadow-xs transition-transform hover:scale-105 cursor-pointer"
      >
        <img src="/ask-artify-logo.png" alt="" className="w-full h-full object-cover" />
      </button>
      {isOpen && <AiAgentChatModal onClose={() => setIsOpen(false)} />}
    </>
  );
};

export default AiAgentButton;
