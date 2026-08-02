-- Trigger-only function: callers must never invoke it through the Data API.
revoke all on function private.snapshot_official_document_brand()
from public, anon, authenticated, service_role;
