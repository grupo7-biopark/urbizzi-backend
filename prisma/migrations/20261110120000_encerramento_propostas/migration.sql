ALTER TABLE propostas ADD COLUMN data_encerramento TIMESTAMPTZ(3), ADD COLUMN motivo_encerramento TEXT;
ALTER TABLE propostas ADD CONSTRAINT propostas_encerramento_check CHECK ((data_encerramento IS NULL AND motivo_encerramento IS NULL) OR (data_encerramento IS NOT NULL AND motivo_encerramento IS NOT NULL AND length(trim(motivo_encerramento)) > 0));
