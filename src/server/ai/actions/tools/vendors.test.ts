import { describe, it, expect } from 'vitest';
import { updateVendorContactInfoTool } from './vendors';
import type { CallerContext } from '../../../authContext';

function caller(overrides: Partial<CallerContext> = {}): CallerContext {
  return { userId: 'user-1', email: 'test@example.com', profile: { full_name: 'Test User' }, role: { code: 'x', permissions: ['vendors.edit'] }, jwt: 'fake-jwt', ...overrides };
}

const VENDOR_ID = '11111111-1111-1111-1111-111111111111';
const VENDOR_ROW = {
  id: VENDOR_ID,
  name: 'Acme Supplies',
  code: 'V-001',
  contact_person: 'Old Contact',
  phone: '9999',
  email: 'old@example.com',
  address: 'Old Address',
  remarks: null,
};

function makeFakeDb(opts: { vendorSelect?: any; auditInsertError?: any } = {}) {
  const auditInserts: any[] = [];
  return {
    from(table: string) {
      if (table === 'vendors') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => opts.vendorSelect ?? { data: { ...VENDOR_ROW }, error: null } }) }),
          update: (patch: any) => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => {
                  if (opts.vendorSelect && opts.vendorSelect.data === null) return { data: null, error: null };
                  return { data: { ...VENDOR_ROW, ...patch }, error: null };
                },
              }),
            }),
          }),
        };
      }
      if (table === 'audit_logs') {
        return { insert: (row: any) => { auditInserts.push(row); return Promise.resolve({ data: null, error: opts.auditInsertError ?? null }); } };
      }
      throw new Error(`unexpected table ${table}`);
    },
    _auditInserts: auditInserts,
  };
}

describe('update_vendor_contact_info — validateArgs', () => {
  it('accepts a valid vendorId with at least one field to update', () => {
    const result = updateVendorContactInfoTool.validateArgs({ vendorId: VENDOR_ID, phone: '12345' });
    expect(result.ok).toBe(true);
  });
  it('rejects when no field to update is provided — nothing to confirm/do', () => {
    expect(updateVendorContactInfoTool.validateArgs({ vendorId: VENDOR_ID }).ok).toBe(false);
  });
  it('rejects a missing/invalid vendorId', () => {
    expect(updateVendorContactInfoTool.validateArgs({ phone: '123' }).ok).toBe(false);
    expect(updateVendorContactInfoTool.validateArgs({ vendorId: 'not-a-uuid', phone: '123' }).ok).toBe(false);
  });
  it('never accepts code/name/category/status/opening_balance — the schema simply has no such fields', () => {
    // TypeScript already enforces this shape at compile time; this is a
    // runtime check that an attempt to smuggle one through is a no-op —
    // validateArgs only ever reads the 5 known keys off the raw object.
    const result = updateVendorContactInfoTool.validateArgs({ vendorId: VENDOR_ID, phone: '123', opening_balance: 999999, code: 'HACKED' } as any);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args).not.toHaveProperty('opening_balance');
      expect(result.args).not.toHaveProperty('code');
    }
  });
});

describe('update_vendor_contact_info — metadata', () => {
  it('is medium risk and requires confirmation', () => {
    expect(updateVendorContactInfoTool.riskLevel).toBe('medium');
    expect(updateVendorContactInfoTool.requiresConfirmation).toBe(true);
  });
});

describe('update_vendor_contact_info — buildPreview', () => {
  it('shows old -> new for only the fields being changed, and names the vendor', async () => {
    const db = makeFakeDb();
    const preview = await updateVendorContactInfoTool.buildPreview({ caller: caller(), db: db as any }, { vendorId: VENDOR_ID, phone: '55555' });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.summary).toMatch(/Acme Supplies/);
      expect(preview.fields).toContainEqual({ label: 'Phone', value: '"9999" -> "55555"' });
      expect(preview.fields.some((f) => f.label === 'Email')).toBe(false); // untouched field not shown
    }
  });

  it('reports a clean not-found error for a nonexistent/inaccessible vendor, never a raw DB error', async () => {
    const db = makeFakeDb({ vendorSelect: { data: null, error: null } });
    const preview = await updateVendorContactInfoTool.buildPreview({ caller: caller(), db: db as any }, { vendorId: VENDOR_ID, phone: '1' });
    expect(preview).toEqual({ ok: false, error: 'Vendor not found.' });
  });
});

describe('update_vendor_contact_info — handler', () => {
  it('updates only the provided fields and writes its own audit_logs row (plain updates get no automatic audit)', async () => {
    const db = makeFakeDb();
    const result = await updateVendorContactInfoTool.handler({ caller: caller(), db: db as any }, { vendorId: VENDOR_ID, phone: '55555', remarks: 'Updated by AI' });

    expect(result.status).toBe('executed');
    expect(db._auditInserts).toHaveLength(1);
    expect(db._auditInserts[0]).toMatchObject({ action: 'AI_UPDATE_VENDOR_CONTACT', module: 'Vendors', entity_type: 'vendor', entity_id: VENDOR_ID });
    expect(db._auditInserts[0].new_values).toEqual({ phone: '55555', remarks: 'Updated by AI' });
  });

  it('never touches financial/identity fields — the update payload only ever contains the 5 editable columns', async () => {
    const db = makeFakeDb();
    let capturedPatch: any = null;
    const spyDb = {
      from: (table: string) => {
        if (table === 'vendors') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...VENDOR_ROW }, error: null }) }) }),
            update: (patch: any) => {
              capturedPatch = patch;
              return { eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { ...VENDOR_ROW, ...patch }, error: null }) }) }) };
            },
          };
        }
        return (db as any).from(table);
      },
    };
    await updateVendorContactInfoTool.handler({ caller: caller(), db: spyDb as any }, { vendorId: VENDOR_ID, contactPerson: 'New Contact' });
    expect(Object.keys(capturedPatch).sort()).toEqual(['contact_person', 'updated_at']);
  });

  it('reports execution_failed, never throws, when the vendor no longer exists at write time', async () => {
    const db = makeFakeDb({ vendorSelect: { data: null, error: null } });
    const result = await updateVendorContactInfoTool.handler({ caller: caller(), db: db as any }, { vendorId: VENDOR_ID, phone: '1' });
    expect(result.status).toBe('execution_failed');
  });
});
