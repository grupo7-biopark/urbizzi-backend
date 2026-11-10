import { MarcadorService } from './marcador.service.js';
import { Marcador } from '../../domain/models/marcador.entity.js';
import type { PlantaService } from '../../../plantas/application/services/planta.service.js';
import type { LoteService } from '../../../loteamentos/application/services/lote.service.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
describe('MarcadorService', () => {
  const tx = {} as PrismaTransaction;
  const repository = {
    copiar: vi.fn(),
    list: vi.fn(),
    loteIds: vi.fn(),
    find: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const plantas = { findById: vi.fn() },
    lotes = { findById: vi.fn(), listExcluindo: vi.fn() },
    auditoria = { registrar: vi.fn(), registrarVarios: vi.fn() };
  const transactions = {
    run: (fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx),
  } as TransactionManager;
  let service: MarcadorService;
  beforeEach(() => {
    vi.resetAllMocks();
    service = new MarcadorService(
      repository,
      plantas as unknown as PlantaService,
      lotes as unknown as LoteService,
      transactions,
      auditoria as unknown as AuditoriaService,
    );
  });
  const input = { loteId: 'l', x: 0, y: 1 };
  it('cria e audita na mesma transação', async () => {
    expect(await service.create('p', input, 'u')).toMatchObject(input);
    expect(auditoria.registrarVarios).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ acao: 'CRIAR' })]),
      tx,
    );
  });
  it('nega lote repetido no lote de criação', async () => {
    await expect(
      service.createMany('p', [input, input], 'u'),
    ).rejects.toMatchObject({ code: 'MARCADOR_DUPLICADO' });
    expect(repository.createMany).not.toHaveBeenCalled();
  });
  it('lista marcadores paginados', async () => {
    repository.list.mockResolvedValue({
      items: [Marcador.create({ ...input, plantaId: 'p' })],
      total: 1,
    });
    expect(
      (await service.list('p', { page: 1, pageSize: 20 })).meta.total,
    ).toBe(1);
  });
  it('lista lotes sem marcador com dados mínimos', async () => {
    repository.loteIds.mockResolvedValue(['l']);
    lotes.listExcluindo.mockResolvedValue({
      data: [
        {
          id: 'outro',
          numero: '2',
          quadraId: 'q',
          loteamentoId: 'e',
          observacoes: 'interno',
        },
      ],
      meta: { total: 1 },
    });
    expect(
      (await service.semMarcador('p', { page: 1, pageSize: 20 })).data[0],
    ).not.toHaveProperty('observacoes');
  });
  it('move e exclui auditando', async () => {
    repository.find.mockResolvedValue(
      Marcador.create({ ...input, plantaId: 'p' }),
    );
    expect((await service.mover('p', 'id', { x: 0.2, y: 0.4 }, 'u')).x).toBe(
      0.2,
    );
    await service.delete('p', 'id', 'u');
    expect(repository.delete).toHaveBeenCalledWith('id', tx);
  });
  it('nega alterações de marcador ausente', async () => {
    repository.find.mockResolvedValue(null);
    await expect(service.mover('p', 'id', input, 'u')).rejects.toMatchObject({
      code: 'MARCADOR_NAO_ENCONTRADO',
    });
    await expect(service.delete('p', 'id', 'u')).rejects.toMatchObject({
      code: 'MARCADOR_NAO_ENCONTRADO',
    });
  });
  it('propaga falha da auditoria', async () => {
    auditoria.registrarVarios.mockRejectedValue(new Error('auditoria'));
    await expect(service.create('p', input, 'u')).rejects.toThrow('auditoria');
  });
});
