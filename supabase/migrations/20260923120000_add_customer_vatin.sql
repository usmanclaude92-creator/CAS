-- Adds VATIN (VAT Identification Number) to the customers master data table.
alter table customers add column if not exists vatin varchar(50);
