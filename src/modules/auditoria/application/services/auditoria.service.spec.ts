import { AuditoriaService } from './auditoria.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
describe('AuditoriaService', () => {
  const input = {
    entidadeTipo: 'Lote',
    entidadeId: 'id',
    acao: 'ALTERAR',
    valorNovo: { senhaHash: 'segredo' },
  };
  it('envia registro mascarado ao repositório na mesma transação', async () => {
    const repository = { create: vi.fn().mockResolvedValue(undefined) };
    const tx = {} as PrismaTransaction;
    await new AuditoriaService(repository).registrar(input, tx);
    const [historico, transacao] = repository.create.mock.calls[0];
    expect(historico.valorNovo).toEqual({ senhaHash: '[MASCARADO]' });
    expect(transacao).toBe(tx);
  });
  it('permite registro independente e propaga falhas de persistência', async () => {
    const erro = new Error('Falha de persistência');
    const repository = { create: vi.fn().mockRejectedValue(erro) };
    await expect(
      new AuditoriaService(repository).registrar(input),
    ).rejects.toBe(erro);
    expect(repository.create).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });
});
