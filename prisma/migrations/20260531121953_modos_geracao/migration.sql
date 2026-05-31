CREATE TYPE "ModoGeracao" AS ENUM ('vicio_forte', 'moderado', 'generico');
CREATE TYPE "ScoreBand" AS ENUM ('alta', 'media', 'moderada_baixa');

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "modo_geracao" "ModoGeracao";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "vicios_finais" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "score_band" "ScoreBand";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "permite_arguir_sumula_312" BOOLEAN NOT NULL DEFAULT false;
