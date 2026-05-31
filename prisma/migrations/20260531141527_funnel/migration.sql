ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gclid" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fbclid" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fbp" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fbc" TEXT;

CREATE TABLE IF NOT EXISTS "FunnelEvent" (
  "id"           BIGSERIAL PRIMARY KEY,
  "session_id"   TEXT,
  "order_id"     TEXT,
  "step"         TEXT NOT NULL,
  "event_id"     TEXT,
  "resultado"    TEXT,
  "device"       TEXT,
  "utm_source"   TEXT,
  "utm_medium"   TEXT,
  "utm_campaign" TEXT,
  "gclid"        TEXT,
  "fbclid"       TEXT,
  "metadata"     JSONB,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FunnelEvent_session_id_idx" ON "FunnelEvent"("session_id");
CREATE INDEX IF NOT EXISTS "FunnelEvent_step_created_at_idx" ON "FunnelEvent"("step", "created_at");
CREATE INDEX IF NOT EXISTS "FunnelEvent_order_id_idx" ON "FunnelEvent"("order_id");

CREATE TABLE IF NOT EXISTS "ConversionOutbox" (
  "id"         BIGSERIAL PRIMARY KEY,
  "order_id"   TEXT NOT NULL,
  "platform"   TEXT NOT NULL,
  "evento"     TEXT NOT NULL,
  "payload"    JSONB NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'pendente',
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at"    TIMESTAMP(3),
  CONSTRAINT "ConversionOutbox_order_id_platform_evento_key" UNIQUE ("order_id", "platform", "evento")
);
CREATE INDEX IF NOT EXISTS "ConversionOutbox_status_created_at_idx" ON "ConversionOutbox"("status", "created_at");
CREATE INDEX IF NOT EXISTS "ConversionOutbox_order_id_idx" ON "ConversionOutbox"("order_id");
