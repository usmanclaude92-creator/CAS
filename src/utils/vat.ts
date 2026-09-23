import { addMoney, multiplyMoney } from './formatters';
import { VatTreatment } from '../types';

// Oman VAT (Royal Decree 121/2020, effective 16 Apr 2021).
export const OMAN_STANDARD_VAT_RATE = 5;

export const VAT_TREATMENT_LABELS: Record<VatTreatment, string> = {
  standard: 'Standard Rated (5%)',
  zero_rated: 'Zero-Rated (0%)',
  exempt: 'Exempt (No VAT)',
  out_of_scope: 'Out of Scope / Non-Registered Party',
  reverse_charge: 'Reverse Charge (Import of Services)',
};

export interface VatSplit {
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grossAmount: number;
  vatTreatment: VatTreatment;
}

// Single source of truth for net -> VAT -> gross math, used by both the
// transaction modals (live preview) and accountingService (what actually
// gets posted), so the two can never drift apart.
//
// - standard: VAT is added on top; gross = net + vat.
// - reverse_charge: the vendor's own bill carries no VAT (self-accounted
//   separately by the recipient), so gross owed to them = net only; vat is
//   still computed and returned for VAT-return reporting.
// - zero_rated / exempt / out_of_scope: no VAT; gross = net.
export function computeVatSplit(netAmount: number, vatRate: number, vatTreatment: VatTreatment): VatSplit {
  const chargesVat = vatTreatment === 'standard' || vatTreatment === 'reverse_charge';
  const effectiveRate = chargesVat ? vatRate : 0;
  const vatAmount = chargesVat ? multiplyMoney(netAmount, effectiveRate / 100) : 0;
  const grossAmount = vatTreatment === 'standard' ? addMoney(netAmount, vatAmount) : netAmount;
  return { netAmount, vatRate: effectiveRate, vatAmount, grossAmount, vatTreatment };
}
