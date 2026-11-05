CREATE FUNCTION notificar_status_lote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('status_lote', json_build_object(
    'loteId', NEW.id,
    'status', NEW.status,
    'loteamentoId', (SELECT loteamento_id FROM quadras WHERE id = NEW.quadra_id)
  )::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER lotes_notificar_status
AFTER UPDATE OF status ON lotes
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notificar_status_lote();
