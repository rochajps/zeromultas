-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value_number" INTEGER,
    "value_text" TEXT,
    "value_bool" BOOLEAN,
    "description" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'geral',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
