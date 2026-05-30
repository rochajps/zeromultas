-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('analisado', 'aguardando_pagamento', 'pago', 'gerado', 'entregue', 'vencido');

-- CreateEnum
CREATE TYPE "Fase" AS ENUM ('defesa_previa', 'jari', 'vencido');

-- CreateEnum
CREATE TYPE "PrazoStatus" AS ENUM ('valido', 'vencido');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('NA', 'NP', 'desconhecido');

-- CreateEnum
CREATE TYPE "PromptTipo" AS ENUM ('analise', 'geracao_defesa_previa', 'geracao_jari', 'extracao_cnh', 'extracao_completa');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'analisado',
    "valor_multa_centavos" INTEGER,
    "faixa_id" INTEGER,
    "preco_centavos" INTEGER,
    "tribopay_hash" TEXT,
    "fase" "Fase",
    "prazo_limite" TIMESTAMP(3),
    "prazo_status" "PrazoStatus",
    "download_token" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "generated_at" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FineData" (
    "id" SERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "is_multa" BOOLEAN,
    "tipo_notificacao" "TipoNotificacao",
    "data_notificacao" TIMESTAMP(3),
    "data_infracao" TIMESTAMP(3),
    "num_ait" TEXT,
    "orgao_autuador" TEXT,
    "codigo_infracao" TEXT,
    "descricao_infracao" TEXT,
    "placa" TEXT,
    "veiculo" TEXT,
    "valor_multa_centavos" INTEGER,
    "vicio_forte" BOOLEAN,
    "vicio_razao" TEXT,
    "vicios_detectados" JSONB,
    "score" INTEGER,
    "raw_analise" JSONB,
    "raw_extracao" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FineData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverData" (
    "id" SERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "num_cnh" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverInput" (
    "id" SERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "motivo_injustica" TEXT NOT NULL,
    "consentimento_lgpd" BOOLEAN NOT NULL DEFAULT false,
    "consentido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTier" (
    "id" SERIAL NOT NULL,
    "faixa" TEXT NOT NULL,
    "valor_multa_min_centavos" INTEGER NOT NULL,
    "valor_multa_max_centavos" INTEGER NOT NULL,
    "preco_centavos" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" SERIAL NOT NULL,
    "tipo" "PromptTipo" NOT NULL,
    "conteudo_md" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recurso" (
    "id" SERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "pdf_path" TEXT NOT NULL,
    "gerado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" SERIAL NOT NULL,
    "login" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "nome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "order_id" TEXT,
    "tipo" TEXT NOT NULL,
    "metadata" JSONB,
    "user_agent" TEXT,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_tribopay_hash_key" ON "Order"("tribopay_hash");

-- CreateIndex
CREATE UNIQUE INDEX "Order_download_token_key" ON "Order"("download_token");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_created_at_idx" ON "Order"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "FineData_order_id_key" ON "FineData"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "DriverData_order_id_key" ON "DriverData"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "DriverInput_order_id_key" ON "DriverInput"("order_id");

-- CreateIndex
CREATE INDEX "PriceTier_ativo_idx" ON "PriceTier"("ativo");

-- CreateIndex
CREATE INDEX "PromptVersion_tipo_ativo_idx" ON "PromptVersion"("tipo", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_tipo_versao_key" ON "PromptVersion"("tipo", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "Recurso_order_id_key" ON "Recurso"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_login_key" ON "AdminUser"("login");

-- CreateIndex
CREATE INDEX "Event_tipo_created_at_idx" ON "Event"("tipo", "created_at");

-- CreateIndex
CREATE INDEX "Event_order_id_idx" ON "Event"("order_id");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_faixa_id_fkey" FOREIGN KEY ("faixa_id") REFERENCES "PriceTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineData" ADD CONSTRAINT "FineData_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverData" ADD CONSTRAINT "DriverData_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverInput" ADD CONSTRAINT "DriverInput_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recurso" ADD CONSTRAINT "Recurso_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
