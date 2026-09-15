-- ==============================================================================
-- CONSTRUCTION ACCOUNTING & FINANCIAL REPORTING SYSTEM
-- Seed Data Script
-- Includes Acceptance Test Baseline Data (Prompt Scenario 49)
-- ==============================================================================

-- 1. EXPENSE HEADS
INSERT INTO expense_heads (name, category, status, remarks) VALUES
('Site Expenses', 'Direct Project Cost', 'active', 'On-site utilities, scaffolding, safety consumables'),
('Fuel & Transport', 'Direct Project Cost', 'active', 'Vehicle fuel, diesel generators, hauling'),
('Salaries & Wages', 'Direct Labor', 'active', 'Site workers, masonry, supervisory payroll'),
('Materials', 'Direct Project Cost', 'active', 'Cement, rebar, aggregates, blocks'),
('Rent', 'Overhead', 'active', 'Site office rent, storage yard lease'),
('Utilities', 'Overhead', 'active', 'Electricity, water, communication bills'),
('Office Expenses', 'Overhead', 'active', 'Stationery, software licenses, printing'),
('Repairs & Maintenance', 'Direct Project Cost', 'active', 'Machinery servicing, vehicle repairs'),
('Equipment', 'Direct Project Cost', 'active', 'Equipment hire, crane rental, earthmoving'),
('Other Expenses', 'Miscellaneous', 'active', 'Uncategorized petty costs')
ON CONFLICT (name) DO NOTHING;

-- 2. BANK ACCOUNTS
INSERT INTO bank_accounts (bank_name, account_name, account_number, currency, opening_balance, current_balance, opening_date, status, remarks) VALUES
('Bank Muscat', 'Bank Muscat — Main Operating Account', '0315-01234567-001', 'OMR', 25000.000, 29000.000, '2026-01-01', 'active', 'Primary corporate operating account'),
('National Bank of Oman', 'NBO — SMI Project Escrow Account', '1004-98765432-002', 'OMR', 10000.000, 10000.000, '2026-01-01', 'active', 'Designated project retention account')
ON CONFLICT DO NOTHING;

-- 3. CASH IN HAND ACCOUNTS
INSERT INTO cash_accounts (account_name, opening_balance, current_balance, opening_date, status, remarks) VALUES
('Head Office Cash Box', 1500.000, 1500.000, '2026-01-01', 'active', 'Main head office cash on hand')
ON CONFLICT DO NOTHING;

-- 4. PETTY CASH ACCOUNTS
INSERT INTO petty_cash_accounts (account_name, opening_balance, current_balance, opening_date, status, remarks) VALUES
('Site Petty Cash Custodian - Al Khoudh', 500.000, 450.000, '2026-01-01', 'active', 'Site petty cash float for emergency site expenses')
ON CONFLICT DO NOTHING;

-- 5. CUSTOMERS
INSERT INTO customers (code, name, contact_person, phone, email, address, opening_balance, status, remarks) VALUES
('CUST-001', 'Al Harthy Properties LLC', 'Eng. Salim Al Harthy', '+968 9123 4567', 'salim@alharthyproperties.om', 'Al Khoudh, Seeb, Muscat, Oman', 0.000, 'active', 'Developer of residential and commercial villas'),
('CUST-002', 'Oman Golden Sands Dev', 'Mr. Tariq Al Balushi', '+968 9988 7766', 'tariq@goldensands.om', 'Bausher, Muscat, Oman', 0.000, 'active', 'Commercial plaza developer')
ON CONFLICT (code) DO NOTHING;

-- 6. VENDORS
INSERT INTO vendors (code, name, contact_person, phone, email, address, opening_balance, status, remarks) VALUES
('VEND-001', 'Al Batinah Building Materials LLC', 'Nasser Al Farsi', '+968 9456 1234', 'sales@batinahmaterials.om', 'Barkha Industrial Area, Oman', 0.000, 'active', 'Primary supplier of steel, rebar, and aggregate'),
('VEND-002', 'Muscat ReadyMix Concrete SAOC', 'Rajesh Kumar', '+968 9234 5678', 'orders@muscatreadymix.om', 'Rusayl Industrial Estate, Muscat', 0.000, 'active', 'Supplier of high grade certified concrete')
ON CONFLICT (code) DO NOTHING;

-- 7. PROJECTS (Including Acceptance Test Scenario Project)
INSERT INTO projects (code, name, customer_id, contract_value, start_date, status, remarks)
SELECT 
  'PRJ-AKV-001', 
  'Al Khoudh Villa Project', 
  c.id, 
  85000.000, 
  '2026-01-15', 
  'active', 
  'G+2 Luxury Villa construction in Al Khoudh 6'
FROM customers c WHERE c.code = 'CUST-001'
ON CONFLICT (code) DO NOTHING;
