BEGIN;

-- Evita novas escritas entre o diagnóstico e a troca dos índices pelo ALTER TYPE.
LOCK TABLE loteamentos, quadras, lotes IN ACCESS EXCLUSIVE MODE;

-- Não escolhe automaticamente um cadastro vencedor nem altera seus vínculos.
-- Em bases antigas, duplicados devem ser conciliados antes de repetir a migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM loteamentos WHERE deleted_at IS NULL
    GROUP BY lower(nome) HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM quadras WHERE deleted_at IS NULL
    GROUP BY loteamento_id, lower(numero) HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM lotes WHERE deleted_at IS NULL
    GROUP BY quadra_id, lower(numero) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem cadastros ativos duplicados sem diferenciar caixa. Concilie os registros conforme docs/database.md antes de reaplicar a migration.';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS citext;

-- Os índices parciais existentes passam a usar a igualdade do citext.
-- A grafia original é preservada; os CHECKs mantêm os limites do antigo varchar.
ALTER TABLE loteamentos ALTER COLUMN nome TYPE citext,
  ADD CONSTRAINT loteamentos_nome_tamanho_check CHECK (char_length(nome) <= 150);
ALTER TABLE quadras ALTER COLUMN numero TYPE citext,
  ADD CONSTRAINT quadras_numero_tamanho_check CHECK (char_length(numero) <= 20);
ALTER TABLE lotes ALTER COLUMN numero TYPE citext,
  ADD CONSTRAINT lotes_numero_tamanho_check CHECK (char_length(numero) <= 20);

COMMIT;
