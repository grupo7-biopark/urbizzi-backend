ALTER TABLE areas_geograficas DROP CONSTRAINT areas_geograficas_tipo_check;
ALTER TABLE areas_geograficas ADD CONSTRAINT areas_geograficas_tipo_check CHECK (tipo IN ('LOTEAMENTO','QUADRA','LOTE'));
