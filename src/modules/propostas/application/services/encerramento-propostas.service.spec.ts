import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { EncerramentoPropostasService } from './encerramento-propostas.service.js';
describe('EncerramentoPropostasService', () => {
  const repository = { listarAbertas: vi.fn(), encerrar: vi.fn() },
    audit = { registrar: vi.fn() },
    tx = {} as PrismaTransaction;
  const service = new EncerramentoPropostasService(
    repository,
    audit as unknown as AuditoriaService,
  );
  beforeEach(() => vi.resetAllMocks());
  it('não altera propostas quando não há nenhuma aberta', async () => {
    repository.listarAbertas.mockResolvedValue([]);
    await service.porCancelamento('r', 'u', false, 'Motivo', tx);
    expect(repository.encerrar).not.toHaveBeenCalled();
  });
  it('exige confirmação antes de encerrar', async () => {
    repository.listarAbertas.mockResolvedValue([
      { id: 'p', status: 'APROVADA' },
    ]);
    await expect(
      service.porCancelamento('r', 'u', false, 'Motivo', tx),
    ).rejects.toMatchObject({ code: 'CONFIRMACAO_CANCELAMENTO_NECESSARIA' });
    expect(repository.encerrar).not.toHaveBeenCalled();
  });
  it('encerra e audita preservando a decisão na mesma transação', async () => {
    repository.listarAbertas.mockResolvedValue([
      { id: 'p', status: 'APROVADA' },
    ]);
    await service.porCancelamento('r', 'u', true, 'Motivo', tx);
    expect(repository.encerrar).toHaveBeenCalledWith(
      ['p'],
      expect.any(Date),
      'Motivo',
      tx,
    );
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'u',
        valorNovo: { status: 'APROVADA', dataEncerramento: expect.any(String) },
      }),
      tx,
    );
  });
  it('propaga falha de auditoria para desfazer o encerramento', async () => {
    repository.listarAbertas.mockResolvedValue([
      { id: 'p', status: 'EM_ANALISE' },
    ]);
    audit.registrar.mockRejectedValue(new Error('falha'));
    await expect(
      service.porCancelamento('r', 'u', true, 'Motivo', tx),
    ).rejects.toThrow('falha');
  });
});
