import { describe, it, expect } from 'vitest';
import type { CallerContext } from '../authContext';
import { TOOL_REGISTRY, getTool, listToolsForCaller } from './registry';

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

describe('TOOL_REGISTRY', () => {
  it('every registered tool has a name, description, and requiredPermission matching a real CAS permission-code shape (module.action)', () => {
    for (const tool of Object.values(TOOL_REGISTRY)) {
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.requiredPermission).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('contains no write-shaped tool names — Phase 1 is read-only by construction, not just by policy', () => {
    for (const name of Object.keys(TOOL_REGISTRY)) {
      expect(name).not.toMatch(/^(create|update|delete|post|approve|reverse|submit)_/);
      expect(name.startsWith('get_')).toBe(true);
    }
  });

  it('the registry key always matches the tool\'s own .name', () => {
    for (const [key, tool] of Object.entries(TOOL_REGISTRY)) {
      expect(key).toBe(tool.name);
    }
  });
});

describe('getTool', () => {
  it('resolves a known tool by name', () => {
    expect(getTool('get_vendors')?.name).toBe('get_vendors');
  });
  it('returns undefined for an unknown tool name — the router turns this into a 400, never a crash or a fallback to arbitrary data access', () => {
    expect(getTool('drop_table_vendors')).toBeUndefined();
    expect(getTool('get_vendors; DELETE FROM vendors')).toBeUndefined();
    expect(getTool('')).toBeUndefined();
  });
});

describe('listToolsForCaller', () => {
  it('super_admin sees every registered tool', () => {
    const admin = caller({ role: { code: 'super_admin', permissions: [] } });
    const listed = listToolsForCaller(admin);
    expect(listed.length).toBe(Object.keys(TOOL_REGISTRY).length);
  });

  it('a caller with no permissions sees no tools', () => {
    const nobody = caller({ role: { code: 'viewer', permissions: [] } });
    expect(listToolsForCaller(nobody)).toEqual([]);
  });

  it('a caller sees only tools whose requiredPermission they hold — this is the "tool a caller can\'t use is absent, not listed-then-refused" guarantee', () => {
    const arUser = caller({ role: { code: 'ar_user', permissions: ['customers.view', 'invoices.view'] } });
    const listed = listToolsForCaller(arUser);
    const names = listed.map((t) => t.name).sort();

    expect(names).toContain('get_clients');
    expect(names).toContain('get_client_balance');
    expect(names).toContain('get_invoices');
    // vendors.view / purchases.view were not granted — those tools must be absent.
    expect(names).not.toContain('get_vendors');
    expect(names).not.toContain('get_vendor_balance');
    expect(names).not.toContain('get_purchase_details');
  });

  it('a null/missing role sees no tools rather than throwing', () => {
    const noRole = caller({ role: null });
    expect(() => listToolsForCaller(noRole)).not.toThrow();
    expect(listToolsForCaller(noRole)).toEqual([]);
  });

  it('changing a caller\'s permission set changes what is listed without any other state involved (no hidden cross-caller cache)', () => {
    const a = caller({ userId: 'a', role: { code: 'x', permissions: ['vendors.view'] } });
    const b = caller({ userId: 'b', role: { code: 'x', permissions: ['customers.view'] } });
    expect(listToolsForCaller(a).map((t) => t.name)).toContain('get_vendors');
    expect(listToolsForCaller(a).map((t) => t.name)).not.toContain('get_clients');
    expect(listToolsForCaller(b).map((t) => t.name)).toContain('get_clients');
    expect(listToolsForCaller(b).map((t) => t.name)).not.toContain('get_vendors');
  });
});
