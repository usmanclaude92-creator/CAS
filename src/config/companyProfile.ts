// Issuer details printed on compliant tax invoice / credit / debit note
// documents. Oman VAT (Executive Regulations, Royal Decree 121/2020)
// requires a tax invoice to show the supplier's name, address, and VAT
// registration number — this is company data (not project data), so it's
// not stored in the database and must be filled in with the real
// registration details before these documents are used for filing.
export const COMPANY_PROFILE = {
  name: 'Artify Construction Accounting System',
  vatin: 'OMxxxxxxxxxxxxx', // TODO: replace with the real Oman VATIN before filing
  crNumber: '', // TODO: Commercial Registration number
  address: '',
  phone: '',
  email: '',
};
