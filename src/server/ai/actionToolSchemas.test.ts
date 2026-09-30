import { describe, it, expect } from 'vitest';
import { ACTION_TOOL_SCHEMAS, actionToolSchemaFor, toProviderActionToolSchema, registeredActionToolNames } from './actionToolSchemas';

describe('ACTION_TOOL_SCHEMAS', () => {
  it('has a hand-written entry for every registered action tool — no tool silently relies on the generic fallback', () => {
    for (const name of registeredActionToolNames()) {
      expect(ACTION_TOOL_SCHEMAS[name]).toBeDefined();
    }
  });

  it('every schema is a JSON-Schema object type with a properties bag', () => {
    for (const schema of Object.values(ACTION_TOOL_SCHEMAS)) {
      expect((schema as any).type).toBe('object');
      expect(typeof (schema as any).properties).toBe('object');
    }
  });
});

describe('actionToolSchemaFor', () => {
  it('returns the hand-written schema for a known action tool', () => {
    expect(actionToolSchemaFor('create_direct_expense')).toBe(ACTION_TOOL_SCHEMAS.create_direct_expense);
  });

  it('falls back to a generic permissive schema for an unknown tool name, rather than throwing', () => {
    expect(() => actionToolSchemaFor('not_a_real_tool')).not.toThrow();
    expect(actionToolSchemaFor('not_a_real_tool')).toEqual({ type: 'object', properties: {} });
  });
});

describe('toProviderActionToolSchema', () => {
  it('bundles name/description/inputSchema for the provider layer', () => {
    const schema = toProviderActionToolSchema('create_reminder', 'Creates a reminder.');
    expect(schema).toEqual({ name: 'create_reminder', description: 'Creates a reminder.', inputSchema: ACTION_TOOL_SCHEMAS.create_reminder });
  });
});
