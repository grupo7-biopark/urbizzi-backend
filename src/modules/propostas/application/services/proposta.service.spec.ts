import { PropostaService } from './proposta.service.js';
import { Proposta } from '../../domain/models/proposta.entity.js';
import type { ReservaService } from '../../../reservas/application/services/reserva.service.js';
import type { ConfiguracaoService } from '../../../configuracoes/application/services/configuracao.service.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
describe('PropostaService', () => {
  const tx = {} as PrismaTransaction;
  const repository = {
    create: vi.fn(),
    findById: vi.fn(),
    findImpedimento: vi.fn(),
    list: vi.fn(),
  };
  const reservas = { findById: vi.fn() },
    config = { getPrazoAnaliseDiasUteis: vi.fn() },
    auditoria = { registrar: vi.fn() };
  const transactions = {
    run: (fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx),
  } as TransactionManager;
  const dto = { valor: '100.00', condicoes: 'À vista' };
  const usuario = {
    id: 'ator',
    nome: 'Gestor',
    email: 'gestor@exemplo.com',
    perfil: 'GESTOR' as const,
  };
  let service: PropostaService;
  beforeEach(() => {
    vi.resetAllMocks();
    reservas.findById.mockResolvedValue({
      vendedorId: 'vendedor',
      status: 'ATIVA',
      dataVencimento: new Date(Date.now() + 86400000),
    });
    config.getPrazoAnaliseDiasUteis.mockResolvedValue(7);
    service = new PropostaService(
      repository,
      reservas as unknown as ReservaService,
      config as unknown as ConfiguracaoService,
      auditoria as unknown as AuditoriaService,
      transactions,
    );
  });
  it('preserva vendedor da reserva e audita sem texto livre', async () => {
    const p = await service.create('r', dto, usuario);
    expect(p.vendedorId).toBe('vendedor');
    expect(reservas.findById).toHaveBeenCalledWith('r', usuario, tx);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 'ator', entidadeTipo: 'Proposta' }),
      tx,
    );
    expect(JSON.stringify(auditoria.registrar.mock.calls)).not.toContain(
      dto.condicoes,
    );
  });
  it.each(['EXPIRADA', 'CANCELADA', 'CONVERTIDA', 'VENCIDA'])(
    'nega reserva %s',
    async (status) => {
      reservas.findById.mockResolvedValue({
        status: status === 'VENCIDA' ? 'ATIVA' : status,
        dataVencimento:
          status === 'VENCIDA' ? new Date(0) : new Date(Date.now() + 86400000),
      });
      await expect(service.create('r', dto, usuario)).rejects.toMatchObject({
        code: 'RESERVA_INVALIDA_PARA_PROPOSTA',
      });
      expect(repository.create).not.toHaveBeenCalled();
    },
  );
  it.each(['EM_ANALISE', 'APROVADA'])(
    'nega proposta impeditiva %s',
    async (status) => {
      repository.findImpedimento.mockResolvedValue(status);
      await expect(service.create('r', dto, usuario)).rejects.toMatchObject({
        code:
          status === 'EM_ANALISE'
            ? 'PROPOSTA_EM_ANALISE'
            : 'PROPOSTA_JA_APROVADA',
      });
    },
  );
  it('propaga erros da auditoria', async () => {
    auditoria.registrar.mockRejectedValue(new Error('auditoria'));
    await expect(service.create('r', dto, usuario)).rejects.toThrow(
      'auditoria',
    );
  });
  it('consulta detalhe e lista paginada pela autorização da reserva', async () => {
    const p = Proposta.create(
      { ...dto, reservaId: 'r', vendedorId: 'v', observacoes: null },
      7,
    );
    repository.findById.mockResolvedValue(p);
    expect((await service.findById('id', usuario)).reservaId).toBe('r');
    repository.list.mockResolvedValue({ items: [p], total: 1 });
    expect(
      (await service.list('r', { page: 1, pageSize: 20 }, usuario)).meta.total,
    ).toBe(1);
  });
  it('retorna 404 para proposta ausente', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findById('id', usuario)).rejects.toMatchObject({
      code: 'PROPOSTA_NAO_ENCONTRADA',
    });
  });
});
