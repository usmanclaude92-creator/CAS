-- Seeds granular sub-category expense heads under the 10 existing cost
-- groups (see COMMON_COST_GROUPS in AddExpenseCategoryModal.tsx /
-- NewExpenseCategoryModal.tsx), tailored to Oman construction accounting.
-- Idempotent: expense_heads.name is globally unique, so re-running this
-- migration is a no-op for rows that already exist.

insert into expense_heads (name, category, status) values
  -- Direct Project Cost
  ('Cement', 'Direct Project Cost', 'active'),
  ('Steel & Rebar', 'Direct Project Cost', 'active'),
  ('Aggregates & Sand', 'Direct Project Cost', 'active'),
  ('Blocks & Bricks', 'Direct Project Cost', 'active'),
  ('Timber & Formwork', 'Direct Project Cost', 'active'),
  ('Tiles & Finishes', 'Direct Project Cost', 'active'),
  ('MEP Materials', 'Direct Project Cost', 'active'),
  ('Paints & Coatings', 'Direct Project Cost', 'active'),
  ('Architect Fees (Project)', 'Direct Project Cost', 'active'),
  ('Structural Consultant Fees', 'Direct Project Cost', 'active'),
  ('MEP Consultant Fees', 'Direct Project Cost', 'active'),
  ('Waste Disposal & Site Cleanup', 'Direct Project Cost', 'active'),
  ('Hoarding & Site Fencing', 'Direct Project Cost', 'active'),

  -- Direct Labor
  ('Skilled Labor Wages', 'Direct Labor', 'active'),
  ('Unskilled Labor Wages', 'Direct Labor', 'active'),
  ('Overtime Wages', 'Direct Labor', 'active'),
  ('Labor Camp & Accommodation', 'Direct Labor', 'active'),

  -- Equipment & Machinery
  ('Crane Rental', 'Equipment & Machinery', 'active'),
  ('Excavator Rental', 'Equipment & Machinery', 'active'),
  ('Concrete Mixer/Pump Rental', 'Equipment & Machinery', 'active'),
  ('Scaffolding Rental', 'Equipment & Machinery', 'active'),
  ('Equipment Diesel & Fuel', 'Equipment & Machinery', 'active'),
  ('Equipment Servicing', 'Equipment & Machinery', 'active'),
  ('Equipment Spare Parts', 'Equipment & Machinery', 'active'),

  -- Subcontracting
  ('Civil Subcontract', 'Subcontracting', 'active'),
  ('MEP Subcontract', 'Subcontracting', 'active'),
  ('Finishing Subcontract', 'Subcontracting', 'active'),
  ('Specialized Trade Subcontract', 'Subcontracting', 'active'),

  -- Site Overheads
  ('Site Office Rent & Setup', 'Site Overheads', 'active'),
  ('Site Security', 'Site Overheads', 'active'),
  ('Site Supervision Staff', 'Site Overheads', 'active'),
  ('Temporary Power (Site)', 'Site Overheads', 'active'),
  ('Temporary Water (Site)', 'Site Overheads', 'active'),
  ('Material Haulage & Transport', 'Site Overheads', 'active'),

  -- Statutory, Municipality & Permits
  ('Building Permit Fees', 'Statutory, Municipality & Permits', 'active'),
  ('Municipality & Wilayat Approval Fees', 'Statutory, Municipality & Permits', 'active'),
  ('NOC Fees', 'Statutory, Municipality & Permits', 'active'),
  ('Omanisation & PASI Contributions', 'Statutory, Municipality & Permits', 'active'),
  ('Labor Card Fees', 'Statutory, Municipality & Permits', 'active'),
  ('Employee Visa & Residency Fees', 'Statutory, Municipality & Permits', 'active'),
  ('Customs Duty - Equipment', 'Statutory, Municipality & Permits', 'active'),
  ('Customs Duty - Materials', 'Statutory, Municipality & Permits', 'active'),

  -- Health, Safety & Environment (HSE)
  ('PPE & Safety Equipment', 'Health, Safety & Environment (HSE)', 'active'),
  ('Safety Officer Costs', 'Health, Safety & Environment (HSE)', 'active'),
  ('Contractor''s All Risk Insurance', 'Health, Safety & Environment (HSE)', 'active'),
  ('Workmen''s Compensation Insurance', 'Health, Safety & Environment (HSE)', 'active'),

  -- Office & Administration
  ('Head Office Rent', 'Office & Administration', 'active'),
  ('Office Electricity & Water', 'Office & Administration', 'active'),
  ('Office Internet & Telephone', 'Office & Administration', 'active'),
  ('Administrative Salaries', 'Office & Administration', 'active'),
  ('Bank Charges', 'Office & Administration', 'active'),
  ('Letter of Credit Charges', 'Office & Administration', 'active'),
  ('Bank Guarantee Commission', 'Office & Administration', 'active'),
  ('Performance Bond Charges', 'Office & Administration', 'active'),
  ('Advance Payment Guarantee Charges', 'Office & Administration', 'active'),
  ('Retention Bond Charges', 'Office & Administration', 'active'),
  ('Audit Fees', 'Office & Administration', 'active'),
  ('Legal Consultancy Fees', 'Office & Administration', 'active'),
  ('IT & Software Licenses', 'Office & Administration', 'active'),
  ('Vehicle & Travel Expenses (Non-Project)', 'Office & Administration', 'active'),
  ('Corporate Insurance', 'Office & Administration', 'active'),
  ('Employee Medical & ROP Fees', 'Office & Administration', 'active'),

  -- Quality Control & Lab Testing
  ('Material Testing', 'Quality Control & Lab Testing', 'active'),
  ('Soil Testing', 'Quality Control & Lab Testing', 'active'),
  ('Third-Party Inspection Fees', 'Quality Control & Lab Testing', 'active'),

  -- Miscellaneous & General
  ('Sundry Expenses (Head Office)', 'Miscellaneous & General', 'active'),
  ('Tender Preparation Costs', 'Miscellaneous & General', 'active'),
  ('Prequalification Fees', 'Miscellaneous & General', 'active')
on conflict (name) do nothing;
