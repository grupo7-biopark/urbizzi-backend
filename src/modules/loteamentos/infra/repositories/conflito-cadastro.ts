import { Prisma } from '../../../../generated/prisma/client.js';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';

const CONFLITOS = {
  loteamento: ['LOTEAMENTO_JA_EXISTE', 'Já existe um loteamento com esse nome'],
  quadra: [
    'QUADRA_JA_EXISTE',
    'Já existe uma quadra com esse número no loteamento',
  ],
  lote: ['LOTE_JA_EXISTE', 'Já existe um lote com esse número na quadra'],
} as const;

/** Pré-checks não substituem o índice único em escritas concorrentes. */
export function relancarErroCadastro(
  erro: unknown,
  tipo: keyof typeof CONFLITOS,
): never {
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === 'P2002'
  ) {
    const [code, message] = CONFLITOS[tipo];
    throw new ConflictError(code, message);
  }
  throw erro;
}
