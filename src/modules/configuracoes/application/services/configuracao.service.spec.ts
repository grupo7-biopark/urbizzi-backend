import { ConfiguracaoService } from './configuracao.service.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
describe('ConfiguracaoService', () => {
  const tx = {} as PrismaTransaction;
  const repository = {
    read: vi.fn(),
    readLimiteRenovacoes: vi.fn(),
    set: vi.fn(),
    lock: vi.fn(),
  };
  const audit = { registrar: vi.fn() };
  let service: ConfiguracaoService;
  beforeEach(() => {
    vi.resetAllMocks();
    repository.read.mockResolvedValue([]);
    repository.set.mockResolvedValue({ id: 'id', anterior: null });
    service = new ConfiguracaoService(
      repository,
      {
        run: async (fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx),
      } as TransactionManager,
      audit as unknown as AuditoriaService,
    );
  });
  it('retorna padrões tipados e reutiliza cache sem expor estado mutável', async () => {
    expect(await service.getPrazoReservaDias()).toBe(7);
    expect(await service.getPrazoAnaliseDiasUteis()).toBe(7);
    expect(repository.read).toHaveBeenCalledTimes(1);
    const page = await service.list({ page: 1, pageSize: 1 });
    expect(page.data).toEqual([{ chave: 'prazo_reserva_dias', valor: 7 }]);
    expect(page.meta.total).toBe(2);
  });
  it('leitura transacional ignora cache', async () => {
    await service.getPrazoReservaDias();
    repository.read.mockResolvedValue([
      { chave: 'prazo_reserva_dias', valor: '10' },
    ]);
    expect(await service.getPrazoReservaDias(tx)).toBe(10);
    expect(repository.read).toHaveBeenLastCalledWith(tx);
  });
  it('atualiza atomicamente, audita ambos os prazos e invalida cache após commit', async () => {
    await service.getPrazoReservaDias();
    repository.set.mockResolvedValue({ id: 'id', anterior: '7' });
    repository.read.mockResolvedValue([
      { chave: 'prazo_reserva_dias', valor: '10' },
      { chave: 'prazo_analise_dias_uteis', valor: '5' },
    ]);
    expect(
      await service.update(
        { prazoReservaDias: 10, prazoAnaliseDiasUteis: 5 },
        'u',
      ),
    ).toEqual({ prazoReservaDias: 10, prazoAnaliseDiasUteis: 5 });
    expect(audit.registrar).toHaveBeenCalledTimes(2);
    expect(repository.lock).toHaveBeenCalledWith(tx);
    expect(await service.getPrazoReservaDias()).toBe(10);
    expect(repository.read).toHaveBeenCalledTimes(3);
  });
  it('aceita atualização parcial e valores iniciais ausentes', async () => {
    await service.update({ prazoAnaliseDiasUteis: 9 }, 'u');
    expect(repository.set).toHaveBeenCalledTimes(1);
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        valorAnterior: { chave: 'prazo_analise_dias_uteis', valor: 7 },
      }),
      tx,
    );
  });
  it('rejeita alteração vazia, prazos inválidos e valores inválidos no banco', async () => {
    await expect(service.update({}, 'u')).rejects.toMatchObject({
      code: 'CONFIGURACAO_VAZIA',
    });
    await expect(
      service.update({ prazoReservaDias: -1 }, 'u'),
    ).rejects.toMatchObject({ code: 'CONFIGURACAO_INVALIDA' });
    repository.read.mockResolvedValue([
      { chave: 'prazo_reserva_dias', valor: 'x' },
    ]);
    await expect(service.getPrazoReservaDias()).rejects.toMatchObject({
      code: 'CONFIGURACAO_INVALIDA',
    });
  });
  it('não invalida leitura confirmada quando a auditoria falha', async () => {
    await service.getPrazoReservaDias();
    audit.registrar.mockRejectedValue(new Error('Falha'));
    await expect(service.update({ prazoReservaDias: 10 }, 'u')).rejects.toThrow(
      'Falha',
    );
    expect(await service.getPrazoReservaDias()).toBe(7);
  });
});
