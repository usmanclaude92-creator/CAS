import { describe, it, expect } from 'vitest';
import { TOOL_SCHEMAS, toolSchemaFor, toProviderToolSchema, registeredToolNames } from './toolSchemas';

describe('TOOL_SCHEMAS', () => {
  it('has a hand-written entry for every registered tool — no tool silently relies on the generic fallback', () => {
    for (const name of registeredToolNames()) {
      expect(TOOL_SCHEMAS[name]).toBeDefined();
    }
  });

  it('every schema is a JSON-Schema object type with a properties bag', () => {
    for (const schema of Object.values(TOOL_SCHEMAS)) {
      expect((schema as any).type).toBe('object');
      expect(typeof (schema as any).properties).toBe('object');
    }
  });
});

describe('toolSchemaFor', () => {
  it('returns the hand-written schema for a known tool', () => {
    expect(toolSchemaFor('get_vendor_balance')).toBe(TOOL_SCHEMAS.get_vendor_balance);
  });

  it('falls back to a generic permissive schema for an unknown tool name, rather than throwing', () => {
    expect(() => toolSchemaFor('not_a_real_tool')).not.toThrow();
    expect(toolSchemaFor('not_a_real_tool')).toEqual({ type: 'object', properties: {} });
  });
});

describe('toProviderToolSchema', () => {
  it('bundles name/description/inputSchema for the provider layer', () => {
    const schema = toProviderToolSchema('get_vendors', 'Lists vendors.');
    expect(schema).toEqual({ name: 'get_vendors', description: 'Lists vendors.', inputSchema: TOOL_SCHEMAS.get_vendors });
  });
});
