-- CreateEnum
CREATE TYPE "perfil_codigo" AS ENUM ('ADMINISTRADOR', 'GESTOR', 'COMERCIAL', 'CONSULTA');

-- CreateEnum
CREATE TYPE "status_lote" AS ENUM ('DISPONIVEL', 'RESERVADO', 'VENDIDO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "status_reserva" AS ENUM ('ATIVA', 'CANCELADA', 'EXPIRADA', 'CONVERTIDA');

-- CreateEnum
CREATE TYPE "status_proposta" AS ENUM ('EM_ANALISE', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "status_planta" AS ENUM ('ENVIADA', 'PROCESSANDO', 'PRONTA', 'ERRO');

-- CreateTable
CREATE TABLE "tokens_recuperacao_senha" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "usado_em" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacao_senha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis" (
    "id" UUID NOT NULL,
    "codigo" "perfil_codigo" NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "perfil_id" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "id" UUID NOT NULL,
    "chave" VARCHAR(100) NOT NULL,
    "valor" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_auditoria" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "entidade_tipo" VARCHAR(50) NOT NULL,
    "entidade_id" UUID NOT NULL,
    "acao" VARCHAR(50) NOT NULL,
    "valor_anterior" JSONB,
    "valor_novo" JSONB,
    "motivo" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loteamentos" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "descricao" TEXT,
    "localizacao" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "loteamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quadras" (
    "id" UUID NOT NULL,
    "loteamento_id" UUID NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "quadras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" UUID NOT NULL,
    "quadra_id" UUID NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "area_m2" DECIMAL(12,2) NOT NULL,
    "valor" DECIMAL(14,2),
    "exibir_valor_publico" BOOLEAN NOT NULL DEFAULT false,
    "status" "status_lote" NOT NULL DEFAULT 'DISPONIVEL',
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "documento" VARCHAR(14) NOT NULL,
    "telefone" VARCHAR(20),
    "email" VARCHAR(254),
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "vendedor_id" UUID NOT NULL,
    "data_inicio" TIMESTAMPTZ(3) NOT NULL,
    "data_vencimento" TIMESTAMPTZ(3) NOT NULL,
    "status" "status_reserva" NOT NULL DEFAULT 'ATIVA',
    "motivo_encerramento" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva_renovacoes" (
    "id" UUID NOT NULL,
    "reserva_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "vencimento_anterior" TIMESTAMPTZ(3) NOT NULL,
    "vencimento_novo" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserva_renovacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propostas" (
    "id" UUID NOT NULL,
    "reserva_id" UUID NOT NULL,
    "vendedor_id" UUID NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "condicoes" TEXT NOT NULL,
    "observacoes" TEXT,
    "status" "status_proposta" NOT NULL DEFAULT 'EM_ANALISE',
    "data_envio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prazo_limite" TIMESTAMPTZ(3) NOT NULL,
    "decidido_por_id" UUID,
    "data_decisao" TIMESTAMPTZ(3),
    "motivo_decisao" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "propostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantas" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" "status_planta" NOT NULL DEFAULT 'ENVIADA',
    "largura_px" INTEGER,
    "altura_px" INTEGER,
    "tiles_path" VARCHAR(255),
    "max_zoom" INTEGER,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "criado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plantas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marcadores" (
    "id" UUID NOT NULL,
    "planta_id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "marcadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links_publicos" (
    "id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "criado_por_id" UUID NOT NULL,
    "loteamento_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "acessos" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "links_publicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_recuperacao_senha_token_hash_key" ON "tokens_recuperacao_senha"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_recuperacao_senha_usuario_id_idx" ON "tokens_recuperacao_senha"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_codigo_key" ON "perfis"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_nome_key" ON "perfis"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_perfil_id_idx" ON "usuarios"("perfil_id");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_chave_key" ON "configuracoes"("chave");

-- CreateIndex
CREATE INDEX "historico_auditoria_entidade_tipo_entidade_id_created_at_idx" ON "historico_auditoria"("entidade_tipo", "entidade_id", "created_at");

-- CreateIndex
CREATE INDEX "historico_auditoria_usuario_id_created_at_idx" ON "historico_auditoria"("usuario_id", "created_at");

-- CreateIndex
CREATE INDEX "historico_auditoria_created_at_idx" ON "historico_auditoria"("created_at");

-- CreateIndex
CREATE INDEX "quadras_loteamento_id_idx" ON "quadras"("loteamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "quadras_loteamento_id_numero_key" ON "quadras"("loteamento_id", "numero") WHERE ("deleted_at" IS NULL);

-- CreateIndex
CREATE INDEX "lotes_quadra_id_idx" ON "lotes"("quadra_id");

-- CreateIndex
CREATE INDEX "lotes_status_idx" ON "lotes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_quadra_id_numero_key" ON "lotes"("quadra_id", "numero") WHERE ("deleted_at" IS NULL);

-- CreateIndex
CREATE INDEX "clientes_nome_idx" ON "clientes"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_documento_key" ON "clientes"("documento") WHERE ("deleted_at" IS NULL);

-- CreateIndex
CREATE INDEX "reservas_lote_id_idx" ON "reservas"("lote_id");

-- CreateIndex
CREATE INDEX "reservas_cliente_id_idx" ON "reservas"("cliente_id");

-- CreateIndex
CREATE INDEX "reservas_vendedor_id_data_vencimento_idx" ON "reservas"("vendedor_id", "data_vencimento");

-- CreateIndex
CREATE INDEX "reservas_status_data_vencimento_idx" ON "reservas"("status", "data_vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_lote_id_ativa_key" ON "reservas"("lote_id") WHERE ("status" = 'ATIVA');

-- CreateIndex
CREATE INDEX "reserva_renovacoes_reserva_id_idx" ON "reserva_renovacoes"("reserva_id");

-- CreateIndex
CREATE INDEX "reserva_renovacoes_usuario_id_idx" ON "reserva_renovacoes"("usuario_id");

-- CreateIndex
CREATE INDEX "propostas_reserva_id_idx" ON "propostas"("reserva_id");

-- CreateIndex
CREATE INDEX "propostas_vendedor_id_idx" ON "propostas"("vendedor_id");

-- CreateIndex
CREATE INDEX "propostas_status_prazo_limite_idx" ON "propostas"("status", "prazo_limite");

-- CreateIndex
CREATE UNIQUE INDEX "propostas_reserva_id_em_analise_key" ON "propostas"("reserva_id") WHERE ("status" = 'EM_ANALISE');

-- CreateIndex
CREATE INDEX "plantas_criado_por_id_idx" ON "plantas"("criado_por_id");

-- CreateIndex
CREATE UNIQUE INDEX "plantas_versao_key" ON "plantas"("versao");

-- CreateIndex
CREATE UNIQUE INDEX "plantas_ativa_key" ON "plantas"("ativa") WHERE ("ativa" = true);

-- CreateIndex
CREATE INDEX "marcadores_lote_id_idx" ON "marcadores"("lote_id");

-- CreateIndex
CREATE UNIQUE INDEX "marcadores_planta_id_lote_id_key" ON "marcadores"("planta_id", "lote_id");

-- CreateIndex
CREATE UNIQUE INDEX "links_publicos_token_key" ON "links_publicos"("token");

-- CreateIndex
CREATE INDEX "links_publicos_criado_por_id_idx" ON "links_publicos"("criado_por_id");

-- CreateIndex
CREATE INDEX "links_publicos_loteamento_id_idx" ON "links_publicos"("loteamento_id");

-- AddForeignKey
ALTER TABLE "tokens_recuperacao_senha" ADD CONSTRAINT "tokens_recuperacao_senha_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_auditoria" ADD CONSTRAINT "historico_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quadras" ADD CONSTRAINT "quadras_loteamento_id_fkey" FOREIGN KEY ("loteamento_id") REFERENCES "loteamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_quadra_id_fkey" FOREIGN KEY ("quadra_id") REFERENCES "quadras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_renovacoes" ADD CONSTRAINT "reserva_renovacoes_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_renovacoes" ADD CONSTRAINT "reserva_renovacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_decidido_por_id_fkey" FOREIGN KEY ("decidido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantas" ADD CONSTRAINT "plantas_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcadores" ADD CONSTRAINT "marcadores_planta_id_fkey" FOREIGN KEY ("planta_id") REFERENCES "plantas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcadores" ADD CONSTRAINT "marcadores_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links_publicos" ADD CONSTRAINT "links_publicos_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links_publicos" ADD CONSTRAINT "links_publicos_loteamento_id_fkey" FOREIGN KEY ("loteamento_id") REFERENCES "loteamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===== Restrições não suportadas pelo Prisma (indicadas no schema.prisma) =====

-- Lote: área positiva e valor não negativo
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_area_m2_check" CHECK ("area_m2" > 0);
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_valor_check" CHECK ("valor" IS NULL OR "valor" >= 0);

-- Cliente: documento só com dígitos, CPF (11) ou CNPJ (14)
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_documento_check" CHECK ("documento" ~ '^([0-9]{11}|[0-9]{14})$');

-- Reserva: vencimento depois do início
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_data_vencimento_check" CHECK ("data_vencimento" > "data_inicio");

-- Proposta: valor positivo e, depois de decidida, gestor, data e motivo obrigatórios (RN10)
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_valor_check" CHECK ("valor" > 0);
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_decisao_check" CHECK (
  "status" = 'EM_ANALISE'
  OR ("decidido_por_id" IS NOT NULL AND "data_decisao" IS NOT NULL AND "motivo_decisao" IS NOT NULL)
);

-- Marcador: coordenadas normalizadas
ALTER TABLE "marcadores" ADD CONSTRAINT "marcadores_x_check" CHECK ("x" >= 0 AND "x" <= 1);
ALTER TABLE "marcadores" ADD CONSTRAINT "marcadores_y_check" CHECK ("y" >= 0 AND "y" <= 1);
