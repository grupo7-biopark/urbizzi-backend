CREATE TABLE "areas_geograficas" (
  "id" UUID PRIMARY KEY,
  "tipo" VARCHAR(10) NOT NULL CHECK ("tipo" IN ('LOTEAMENTO', 'LOTE')),
  "loteamento_id" UUID NOT NULL REFERENCES "loteamentos"("id"),
  "vertices" JSONB NOT NULL CHECK (jsonb_typeof("vertices") = 'array'),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "areas_geograficas_loteamento_id_tipo_idx" ON "areas_geograficas"("loteamento_id", "tipo");
