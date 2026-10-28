#!/bin/sh
set -eu
# Sem set -x: o ambiente contém credenciais.
rm -f /tmp/garage-ready
/garage server --single-node --default-access-key &
server_pid=$!
trap 'kill -TERM "$server_pid" 2>/dev/null || true; wait "$server_pid" || true; exit 0' TERM INT

attempt=0
until /garage status >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ] || ! kill -0 "$server_pid" 2>/dev/null; then
    echo 'Garage não iniciou dentro do prazo' >&2
    kill -TERM "$server_pid" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

for bucket in "$S3_BUCKET_ORIGINAIS" "$S3_BUCKET_TILES"; do
  if ! /garage bucket info "$bucket" >/dev/null 2>&1; then
    /garage bucket create "$bucket" >/dev/null
  fi
  /garage bucket allow --read --write "$bucket" --key "$GARAGE_DEFAULT_ACCESS_KEY" >/dev/null
done
/garage key deny --create-bucket "$GARAGE_DEFAULT_ACCESS_KEY" >/dev/null
touch /tmp/garage-ready
echo 'Garage pronto: layout, chave e buckets configurados'
wait "$server_pid"
