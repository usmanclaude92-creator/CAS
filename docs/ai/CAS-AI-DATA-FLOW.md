# CAS AI — Data Flow (target, Phase 1 read-only)

## Request lifecycle

```
1. User types a question in the CAS UI (web/android/ios — same bundle).
2. Client calls POST /api/ai/query with:
     - Authorization: Bearer <current Supabase session JWT>   (already how /api/admin/* works)
     - { question: string, conversationId?: string }
3. AI Gateway (new Express route in src/server/app.ts):
   a. getCallerContext(req)  -> verify JWT, load profile + role.  401 if invalid/inactive.
   b. Build the tool list available to this caller: filter the full CAS-AI-TOOL-REGISTRY.md
      catalog down to tools whose required permission the caller actually has
      (callerHasPermission-equivalent). A tool the caller can't use is not even offered
      to the model — this is stronger than trusting the model to decline politely.
   c. Call Claude with: system prompt (guardrails, see below) + filtered tool schemas +
      conversation history + the question.
   d. On each tool_use the model emits:
        - Re-check permission for that specific tool (defense in depth vs. a prompt-injected
          attempt to call a tool that was filtered out but somehow still requested).
        - Execute the tool against Postgres using a Supabase client authenticated with the
          CALLER'S OWN JWT (not service_role) -> RLS applies exactly as it would for that
          user in the normal UI.
        - Write one row to the new ai_tool_calls audit table (see below) BEFORE returning
          the result to the model, including the actual row-count/identifiers returned
          (not the full payload, to bound audit-table size) so a human can reconstruct
          exactly what data the AI saw, even if the model's final answer misstates it.
        - Return the tool result to Claude.
   e. Claude produces a final natural-language answer, constrained by the system prompt to
      only state facts traceable to a tool result in this turn.
   f. Write one row to ai_conversations (or append to the existing conversation) with the
      question, the final answer, model/provider, and token usage.
4. Response returns to the client; UI renders it in a chat-style panel.
```

## Why the audit write happens server-side, before the answer is returned

`audit_logs` today is written by client code (`accountingService.ts`) under an RLS insert policy that only checks `is_active_user()` — adequate for a human-driven UI where the write always accompanies a real, RLS-validated business mutation the same request just made. It is **not** adequate as the AI's own record, because:

- The client never has an opportunity to lie about *which tool ran with which arguments* if the audit write happens inside the AI Gateway itself, before the response is even serialized back to the browser. A purely client-logged AI audit trail would let a compromised or modified client simply skip logging, or log something different from what actually happened server-side.
- Financial-system audit requirements (and this system's own `audit.view`/`audit.export` permissions, `AuditLogView.tsx`) expect the log to be trustworthy independent of the client.

**Recommendation:** a dedicated `ai_tool_calls` table (server-write only — no client-facing insert policy at all, written exclusively via the `service_role` client already available in `src/server/app.ts`), separate from the existing `audit_logs` table rather than overloading it. Keeping them separate avoids retrofitting `audit_logs`' schema (built for transactional business events: `entity_type`, `transaction_id`, `document_ref`) to fit a different shape (tool name, arguments, token usage, model). See `CAS-AI-IMPLEMENTATION-ROADMAP.md` for the proposed columns.

## Failure modes and what the user sees

| Failure | Behavior |
|---|---|
| Caller's JWT invalid/expired | 401, same as any other API call — client already knows how to handle this (re-login flow exists in `authService.ts`) |
| Caller lacks permission for every tool relevant to the question | Model is given zero matching tools; system prompt instructs it to say plainly that it cannot access that information rather than guessing |
| Caller has partial access (e.g. can see their own project but not the one asked about) | The tool itself returns zero rows (RLS-scoped) — model reports "no matching records," never "you don't have permission" (which would leak that the project *exists*) unless the app-layer check already rejected the call with a clear permission error |
| Tool call errors (DB timeout, bad input) | Returned to the model as a tool error result, never surfaced as fabricated data; final answer must acknowledge the failure |
| Ambiguous question (e.g. two vendors with similar names) | Model calls a lookup/search tool first (see `CAS-AI-TOOL-REGISTRY.md`) and asks for disambiguation rather than guessing which vendor |
