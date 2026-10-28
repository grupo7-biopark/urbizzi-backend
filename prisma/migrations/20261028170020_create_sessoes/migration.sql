-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "revogado_em" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_usuario_id_idx" ON "sessoes"("usuario_id");

-- CreateIndex
CREATE INDEX "sessoes_expira_em_idx" ON "sessoes"("expira_em");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
