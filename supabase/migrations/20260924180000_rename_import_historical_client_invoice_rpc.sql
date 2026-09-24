-- Renames import_historical_client_invoice to import_client_invoice.
-- ALTER FUNCTION ... RENAME preserves grants, ownership, and the
-- SECURITY DEFINER setting, so no re-grant is needed.
alter function import_historical_client_invoice(jsonb) rename to import_client_invoice;
