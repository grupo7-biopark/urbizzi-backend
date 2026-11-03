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
    const repository = {
      create: vi.fn().mockResolvedValue(undefined),
      createMany: vi.fn(),
    };
    const tx = {} as PrismaTransaction;
    await new AuditoriaService(repository).registrar(input, tx);
    const [historico, transacao] = repository.create.mock.calls[0];
    expect(historico.valorNovo).toEqual({ senhaHash: '[MASCARADO]' });
    expect(transacao).toBe(tx);
  });
  it('permite registro independente e propaga falhas de persistência', async () => {
    const erro = new Error('Falha de persistência');
    const repository = {
      create: vi.fn().mockRejectedValue(erro),
      createMany: vi.fn(),
    };
    await expect(
      new AuditoriaService(repository).registrar(input),
    ).rejects.toBe(erro);
    expect(repository.create).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });
  it('registra vários históricos mascarados em uma única inserção', async () => {
    const repository = { create: vi.fn(), createMany: vi.fn() };
    const tx = {} as PrismaTransaction;
    await new AuditoriaService(repository).registrarVarios(
      [input, { ...input, entidadeId: 'outro' }],
      tx,
    );
    const [historicos, transacao] = repository.createMany.mock.calls[0];
    expect(historicos.map((h: { entidadeId: string }) => h.entidadeId)).toEqual(
      ['id', 'outro'],
    );
    expect(historicos[0].valorNovo).toEqual({ senhaHash: '[MASCARADO]' });
    expect(transacao).toBe(tx);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
