import React, { useState } from 'react';
import { AiAgentChatModal } from './modals/AiAgentChatModal';

/**
 * The app-wide entry point into the read-only Ask Artify assistant (Phase 2).
 * A floating action button fixed to the bottom-right corner, always visible
 * regardless of scroll position or active view — deliberately distinct from
 * the app's in-flow header/sidebar controls, so it reads as "assistant," not
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
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 w-14 h-14 rounded-full overflow-hidden shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 cursor-pointer print:hidden"
      >
        <img src="/ask-artify-logo.png" alt="" className="w-full h-full object-cover" />
      </button>
      {isOpen && <AiAgentChatModal onClose={() => setIsOpen(false)} />}
    </>
  );
};

export default AiAgentButton;
