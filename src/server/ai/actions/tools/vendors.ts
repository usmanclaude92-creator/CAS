import type { ActionToolDefinition, ActionPreviewField } from '../types';
import { asRecord, requireUuid, optionalString } from '../../validation';

interface UpdateVendorContactArgs {
  vendorId: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  remarks?: string;
}

const EDITABLE_FIELDS = ['contactPerson', 'phone', 'email', 'address', 'remarks'] as const;
const COLUMN_BY_FIELD: Record<(typeof EDITABLE_FIELDS)[number], string> = {
  contactPerson: 'contact_person',
  phone: 'phone',
  email: 'email',
  address: 'address',
  remarks: 'remarks',
};
const LABEL_BY_FIELD: Record<(typeof EDITABLE_FIELDS)[number], string> = {
  contactPerson: 'Contact Person',
  phone: 'Phone',
  email: 'Email',
  address: 'Address',
  remarks: 'Remarks',
};

interface VendorRow {
  id: string;
  name: string;
  code: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  remarks: string | null;
}

/**
 * The MEDIUM-risk reference action tool. Deliberately scoped to non-
 * financial contact metadata ONLY — never code/name/category/status/
 * opening_balance, matching the "update permitted metadata" example in the
 * Phase 5 directive's §5, not the more sensitive master-record fields.
 * `vendors.edit` is the exact same permission a human uses to edit a
 * vendor through the ordinary UI (see supabase/migrations's
 * "vendors_update" RLS policy) — no separate permission was invented for
 * this tool. Note: no existing edit code path exists anywhere in this app
 * for vendors (confirmed by inspection — accountingService.ts only ever
 * creates master records, never updates them), so this plain,
 * RLS-guarded `.update()` follows the SAME convention accountingService.ts
 * already uses for vendor CREATE (Pattern B: plain insert/update relying on
 * RLS, not a SECURITY DEFINER RPC) — there is no existing update logic to
 * duplicate.
 */
export const updateVendorContactInfoTool: ActionToolDefinition<UpdateVendorContactArgs, VendorRow> = {
  name: 'update_vendor_contact_info',
  description: 'Updates a vendor\'s contact person, phone, email, address, and/or remarks. Never changes the vendor code, name, category, status, or opening balance.',
  requiredPermission: 'vendors.edit',
  category: 'update',
  riskLevel: 'medium',
  transactional: true,
  requiresConfirmation: true,

  validateArgs(raw) {
    const r = asRecord(raw);
    const vendorId = requireUuid(r.vendorId, 'vendorId');
    if (vendorId.ok === false) return vendorId;

    const contactPerson = optionalString(r.contactPerson, 'contactPerson', 255);
    if (contactPerson.ok === false) return contactPerson;
    const phone = optionalString(r.phone, 'phone', 50);
    if (phone.ok === false) return phone;
    const email = optionalString(r.email, 'email', 255);
    if (email.ok === false) return email;
    const address = optionalString(r.address, 'address', 2000);
    if (address.ok === false) return address;
    const remarks = optionalString(r.remarks, 'remarks', 2000);
    if (remarks.ok === false) return remarks;

    if (
      contactPerson.value === undefined &&
      phone.value === undefined &&
      email.value === undefined &&
      address.value === undefined &&
      remarks.value === undefined
    ) {
      return { ok: false, error: 'At least one field to update must be provided.' };
    }

    return {
      ok: true,
      args: {
        vendorId: vendorId.value,
        contactPerson: contactPerson.value,
        phone: phone.value,
        email: email.value,
        address: address.value,
        remarks: remarks.value,
      },
    };
  },

  async buildPreview(ctx, args) {
    const { data, error } = await ctx.db
      .from('vendors')
      .select('id, name, code, contact_person, phone, email, address, remarks')
      .eq('id', args.vendorId)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, error: 'Vendor not found.' };
    }
    const vendor = data as VendorRow;

    const fields: ActionPreviewField[] = [{ label: 'Vendor', value: `${vendor.name} (${vendor.code})` }];
    for (const field of EDITABLE_FIELDS) {
      const newValue = args[field];
      if (newValue === undefined) continue;
      const column = COLUMN_BY_FIELD[field];
      const oldValue = (vendor as any)[column] || '(empty)';
      fields.push({ label: LABEL_BY_FIELD[field], value: `"${oldValue}" -> "${newValue}"` });
    }

    return {
      ok: true,
      summary: `Update contact details for vendor ${vendor.name} (${vendor.code})`,
      entityType: 'vendor',
      fields,
      irreversible: false,
    };
  },

  async handler(ctx, args) {
    const patch: Record<string, string> = {};
    for (const field of EDITABLE_FIELDS) {
      const value = args[field];
      if (value !== undefined) patch[COLUMN_BY_FIELD[field]] = value;
    }
    if (Object.keys(patch).length === 0) {
      return { status: 'validation_failed', error: 'At least one field to update must be provided.' };
    }

    const { data: before } = await ctx.db
      .from('vendors')
      .select('name, contact_person, phone, email, address, remarks')
      .eq('id', args.vendorId)
      .maybeSingle();

    const { data, error } = await ctx.db
      .from('vendors')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', args.vendorId)
      .select('id, name, code, contact_person, phone, email, address, remarks')
      .maybeSingle();

    if (error || !data) {
      return { status: 'execution_failed', error: 'Failed to update the vendor. It may no longer exist or you may no longer have permission.' };
    }

    // Plain .update() calls get no automatic audit_logs row (unlike the
    // transactional RPCs, which insert one themselves) — mirrors
    // accountingService.ts's persistAuditLog() shape exactly.
    await ctx.db.from('audit_logs').insert({
      user_id: ctx.caller.userId,
      user_name: ctx.caller.profile?.full_name || ctx.caller.email,
      user_role: ctx.caller.role?.code || 'unknown',
      action: 'AI_UPDATE_VENDOR_CONTACT',
      module: 'Vendors',
      entity_type: 'vendor',
      entity_id: args.vendorId,
      old_values: before ?? null,
      new_values: patch,
      details: `AI Agent updated contact details for vendor "${data.name}" at the user's request and confirmation.`,
    });

    return { status: 'executed', data: data as VendorRow, affectedResource: { table: 'vendors', id: data.id } };
  },
};
