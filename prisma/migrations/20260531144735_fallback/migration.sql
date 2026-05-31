CREATE TYPE "AnaliseStatus" AS ENUM ('valido', 'multa_nao_suportada', 'nao_multa', 'ilegivel', 'suspeito', 'baixa_confianca', 'schema_invalido');
CREATE TYPE "OrigemDados" AS ENUM ('analise', 'manual');

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "analise_status" "AnaliseStatus";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tipo_documento" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "verificado" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "origem_dados" "OrigemDados" NOT NULL DEFAULT 'analise';

CREATE TABLE IF NOT EXISTS "ManualFineData" (
  "id"                SERIAL PRIMARY KEY,
  "order_id"          TEXT NOT NULL UNIQUE,
  "tipo_notificacao"  TEXT,
  "orgao_autuador"    TEXT,
  "num_ait"           TEXT,
  "codigo_infracao"   TEXT,
  "descricao_infracao" TEXT,
  "data_infracao"     TIMESTAMP(3),
  "data_notificacao"  TIMESTAMP(3),
  "placa"             TEXT,
  "valor_centavos"    INTEGER,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualFineData_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
