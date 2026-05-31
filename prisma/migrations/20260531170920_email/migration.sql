ALTER TABLE "DriverData" ADD COLUMN IF NOT EXISTS "email" TEXT;

CREATE TABLE IF NOT EXISTS "EmailOutbox" (
  "id"                  SERIAL PRIMARY KEY,
  "order_id"            TEXT NOT NULL,
  "tipo"                TEXT NOT NULL,
  "destinatario"        TEXT NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'pendente',
  "tentativas"          INTEGER NOT NULL DEFAULT 0,
  "last_error"          TEXT,
  "provider_message_id" TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at"             TIMESTAMP(3),
  CONSTRAINT "EmailOutbox_order_id_tipo_key" UNIQUE ("order_id", "tipo")
);
CREATE INDEX IF NOT EXISTS "EmailOutbox_status_created_at_idx" ON "EmailOutbox"("status", "created_at");
CREATE INDEX IF NOT EXISTS "EmailOutbox_order_id_idx" ON "EmailOutbox"("order_id");
