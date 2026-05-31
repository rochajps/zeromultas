CREATE TABLE IF NOT EXISTS "IntegrationConfig" (
  "key"        TEXT NOT NULL PRIMARY KEY,
  "value"      TEXT NOT NULL,
  "is_secret"  BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EventMapping" (
  "id"          SERIAL PRIMARY KEY,
  "step"        TEXT NOT NULL,
  "platform"    TEXT NOT NULL,
  "event_name"  TEXT NOT NULL,
  "enabled"     BOOLEAN NOT NULL DEFAULT true,
  "value_cents" INTEGER,
  "currency"    TEXT NOT NULL DEFAULT 'BRL',
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EventMapping_step_platform_key" ON "EventMapping"("step", "platform");
