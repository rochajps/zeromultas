CREATE TABLE IF NOT EXISTS "AnalysisCache" (
  "hash"        TEXT NOT NULL PRIMARY KEY,
  "resultado"   JSONB NOT NULL,
  "cnt_hits"    INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expira_em"   TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "AnalysisCache_expira_em_idx" ON "AnalysisCache"("expira_em");

CREATE TABLE IF NOT EXISTS "UsageCounter" (
  "id"         SERIAL PRIMARY KEY,
  "janela"     TEXT NOT NULL UNIQUE,
  "total"      INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SecurityEvent" (
  "id"          SERIAL PRIMARY KEY,
  "acao"        TEXT NOT NULL,
  "ip_hash"     TEXT,
  "session_id"  TEXT,
  "fingerprint" TEXT,
  "regra"       TEXT,
  "metadata"    JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SecurityEvent_acao_created_at_idx" ON "SecurityEvent"("acao", "created_at");
CREATE INDEX IF NOT EXISTS "SecurityEvent_ip_hash_idx" ON "SecurityEvent"("ip_hash");
