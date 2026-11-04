import { ExpiracaoReservaService } from './expiracao-reserva.service.js';
import { Reserva } from '../../domain/models/reserva.entity.js';
import type { LoteService } from '../../../loteamentos/application/services/lote.service.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
describe('Expiração de reservas', () => {
  const repo = {
    candidatas: vi.fn(),
    travarVencida: vi.fn(),
    expirar: vi.fn(),
  };
  const lotes = { liberarReserva: vi.fn() };
  const audit = { registrar: vi.fn() };
  const tx = {} as PrismaTransaction;
  const service = new ExpiracaoReservaService(
    repo,
    lotes as unknown as LoteService,
    audit as unknown as AuditoriaService,
    {
      run: (fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx),
    } as TransactionManager,
  );
  const agora = new Date('2026-02-01');
  const criar = () =>
    Reserva.create(
      { loteId: 'l', clienteId: 'c', vendedorId: 'v' },
      1,
      new Date('2026-01-01'),
    );
  beforeEach(() => {
    vi.resetAllMocks();
    repo.candidatas.mockResolvedValueOnce(['a', 'b']).mockResolvedValue([]);
  });
  it('expira elegível e ignora registro protegido ou já processado sob bloqueio', async () => {
    repo.travarVencida
      .mockResolvedValueOnce(criar())
      .mockResolvedValueOnce(null);
    expect(await service.executar(agora)).toEqual({ expiradas: 1, falhas: 0 });
    expect(repo.candidatas).toHaveBeenLastCalledWith(agora, 'b');
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: null, acao: 'EXPIRAR' }),
      tx,
    );
  });
  it('contabiliza falhas sem impedir outras reservas e propaga falha da consulta', async () => {
    repo.travarVencida.mockImplementation(async () => criar());
    lotes.liberarReserva.mockRejectedValueOnce(new Error('falha'));
    expect(await service.executar(agora)).toEqual({ expiradas: 1, falhas: 1 });
    repo.candidatas.mockRejectedValue(new Error('banco'));
    await expect(service.executar(agora)).rejects.toThrow('banco');
  });
});
