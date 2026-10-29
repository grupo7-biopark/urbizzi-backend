import { randomUUID } from 'node:crypto';
import { BusinessRuleError } from '../../domain/errors/domain.error.js';

export function assertStorageKey(key: string, allowEmpty = false): void {
  if (
    (!allowEmpty && !key) ||
    Buffer.byteLength(key) > 1024 ||
    key.includes('\\') ||
    [...key].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) ||
    key.startsWith('/') ||
    key.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw new BusinessRuleError(
      'CHAVE_ARQUIVO_INVALIDA',
      'Chave de arquivo inválida',
    );
  }
}

/** Gera nome opaco no servidor; nunca usa o nome original enviado pelo usuário. */
export function createStorageKey(prefix: string, extension: string): string {
  const normalized = prefix.replace(/\/+$/, '');
  assertStorageKey(normalized, true);
  const ext = extension.replace(/^\./, '').toLowerCase();
  if (!/^[a-z0-9]{1,10}$/.test(ext))
    throw new BusinessRuleError(
      'EXTENSAO_ARQUIVO_INVALIDA',
      'Extensão de arquivo inválida',
    );
  const key = [normalized, `${randomUUID()}.${ext}`].filter(Boolean).join('/');
  assertStorageKey(key);
  return key;
}
