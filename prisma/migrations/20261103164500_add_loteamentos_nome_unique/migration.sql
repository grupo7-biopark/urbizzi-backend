-- CreateIndex
CREATE UNIQUE INDEX "loteamentos_nome_key" ON "loteamentos"("nome") WHERE ("deleted_at" IS NULL);

