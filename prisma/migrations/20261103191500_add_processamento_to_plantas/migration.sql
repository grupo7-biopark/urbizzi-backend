-- AlterTable
ALTER TABLE "plantas" ADD COLUMN     "mensagem_erro" TEXT,
ADD COLUMN     "processamento_iniciado_em" TIMESTAMPTZ(3),
ADD COLUMN     "tamanho_tile" INTEGER;

-- CreateIndex
CREATE INDEX "plantas_status_created_at_idx" ON "plantas"("status", "created_at");
