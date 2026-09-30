import { describe, it, expect } from 'vitest';
import type { CallerContext } from '../authContext';
import { ACTION_TOOL_REGISTRY, getActionTool, listActionToolsForCaller } from './actionRegistry';

function caller(overrides: Partial<CallerContext> = {}): CallerContext {
  return {
    userId: 'user-1',
    email: 'test@example.com',
    profile: { status: 'active' },
    role: { code: 'viewer', permissions: [] },
    jwt: 'fake-jwt',
    ...overrides,
  };
}

describe('ACTION_TOOL_REGISTRY', () => {
  it('every registered action tool has a name, description, and requiredPermission matching a real CAS permission-code shape (module.action)', () => {
    for (const tool of Object.values(ACTION_TOOL_REGISTRY)) {
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.requiredPermission).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('contains only write-shaped tool names — the opposite invariant of registry.ts\'s read-only TOOL_REGISTRY, and structurally kept in a SEPARATE object so that guard never has to change', () => {
    for (const name of Object.keys(ACTION_TOOL_REGISTRY)) {
      expect(name).toMatch(/^(create|update|delete|trigger|approve|post)_/);
    }
  });

  it("the registry key always matches the tool's own .name", () => {
    for (const [key, tool] of Object.entries(ACTION_TOOL_REGISTRY)) {
      expect(key).toBe(tool.name);
    }
  });

  it('every medium or high risk tool requires confirmation — the model can never skip confirmation for a risk level that mandates it, because this is asserted for every registered tool, not left to each tool author to remember', () => {
    for (const tool of Object.values(ACTION_TOOL_REGISTRY)) {
      if (tool.riskLevel === 'medium' || tool.riskLevel === 'high') {
        expect(tool.requiresConfirmation).toBe(true);
      }
    }
  });

  it('every tool declares a risk level and category from the fixed, finite sets — never freeform', () => {
    for (const tool of Object.values(ACTION_TOOL_REGISTRY)) {
      expect(['low', 'medium', 'high']).toContain(tool.riskLevel);
      expect(['create', 'update', 'workflow', 'notification', 'administrative']).toContain(tool.category);
    }
  });

  it('references the real, known reference tools by name (sanity check the registry is wired up)', () => {
    expect(Object.keys(ACTION_TOOL_REGISTRY).sort()).toEqual(['create_direct_expense', 'create_reminder', 'update_vendor_contact_info']);
  });
});

describe('getActionTool', () => {
  it('resolves a known action tool by name', () => {
    expect(getActionTool('create_reminder')?.name).toBe('create_reminder');
  });
  it('returns undefined for an unknown/hallucinated/injected tool name — never a crash or a fallback to arbitrary execution', () => {
    expect(getActionTool('drop_table_vendors')).toBeUndefined();
    expect(getActionTool('create_direct_expense; DELETE FROM direct_expenses')).toBeUndefined();
    expect(getActionTool('')).toBeUndefined();
    // A read-tool name must never resolve here — the two registries are
    // structurally separate, so this also proves no accidental merge.
    expect(getActionTool('get_vendors')).toBeUndefined();
  });
});

describe('listActionToolsForCaller', () => {
  it('super_admin sees every registered action tool', () => {
    const admin = caller({ role: { code: 'super_admin', permissions: [] } });
    expect(listActionToolsForCaller(admin).length).toBe(Object.keys(ACTION_TOOL_REGISTRY).length);
  });

  it('a caller with no permissions sees no action tools — never listed-then-refused', () => {
    const nobody = caller({ role: { code: 'viewer', permissions: [] } });
    expect(listActionToolsForCaller(nobody)).toEqual([]);
  });

  it('a caller sees only the action tools whose requiredPermission they hold, and each descriptor discloses risk/confirmation honestly', () => {
    const authorized = caller({ role: { code: 'x', permissions: ['ai_actions.use'] } });
    const listed = listActionToolsForCaller(authorized);
    expect(listed.map((t) => t.name)).toEqual(['create_reminder']);
    expect(listed[0].riskLevel).toBe('low');
    expect(listed[0].requiresConfirmation).toBe(false);
  });

  it('holding a business permission (e.g. expenses.create) alone, without ai_actions.use, still surfaces the matching action tool — each tool gates on its OWN permission, not a blanket one', () => {
    const financeUser = caller({ role: { code: 'x', permissions: ['expenses.create'] } });
    const listed = listActionToolsForCaller(financeUser);
    expect(listed.map((t) => t.name)).toEqual(['create_direct_expense']);
  });

  it('a null/missing role sees no action tools rather than throwing', () => {
    const noRole = caller({ role: null });
    expect(() => listActionToolsForCaller(noRole)).not.toThrow();
    expect(listActionToolsForCaller(noRole)).toEqual([]);
  });
});
