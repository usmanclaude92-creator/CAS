-- Adds VATIN (VAT Identification Number) to the vendors master data table,
-- mirroring the customers.vatin column — first step of Oman VAT rollout
-- (Phase 0: master-data VATIN capture for both trading-partner types).
alter table vendors add column if not exists vatin varchar(50);
