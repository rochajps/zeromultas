CREATE TABLE IF NOT EXISTS "ApiUsage" (
  "id" SERIAL NOT NULL,
  "order_id" TEXT,
  "kind" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "input_tokens" INTEGER NOT NULL,
  "output_tokens" INTEGER NOT NULL,
  "cache_creation_input_tokens" INTEGER NOT NULL DEFAULT 0,
  "cache_read_input_tokens" INTEGER NOT NULL DEFAULT 0,
  "request_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApiUsage_kind_created_at_idx" ON "ApiUsage"("kind", "created_at");
CREATE INDEX IF NOT EXISTS "ApiUsage_order_id_idx" ON "ApiUsage"("order_id");

ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
