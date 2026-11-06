import { ReservaService } from './reserva.service.js';
import { Reserva } from '../../domain/models/reserva.entity.js';
import type { LoteService } from '../../../loteamentos/application/services/lote.service.js';
import type { ClienteService } from '../../../clientes/application/services/cliente.service.js';
import type { ConfiguracaoService } from '../../../configuracoes/application/services/configuracao.service.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
describe('ReservaService', () => {
  const repository = {
    create: vi.fn(),
    findById: vi.fn(),
    travarAtivaPorLote: vi.fn(),
    findPropostaAprovada: vi.fn(),
    converter: vi.fn(),
  };
  const lotes = { reservar: vi.fn(), findById: vi.fn(), vender: vi.fn() };
  const clientes = { validarExistencia: vi.fn() };
  const config = { getPrazoReservaDias: vi.fn() };
  const audit = { registrar: vi.fn() };
  const tx = {} as PrismaTransaction;
  const service = new ReservaService(
    repository,
    lotes as unknown as LoteService,
    clientes as unknown as ClienteService,
    config as unknown as ConfiguracaoService,
    audit as unknown as AuditoriaService,
    {
      run: (fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx),
    } as TransactionManager,
  );
  const u = {
    id: 'v',
    nome: 'Nome',
    email: 'teste@exemplo.com',
    perfil: 'COMERCIAL' as const,
  };
  const dto = { loteId: 'l', clienteId: 'c' };
  beforeEach(() => {
    vi.resetAllMocks();
    config.getPrazoReservaDias.mockResolvedValue(7);
  });
  it('coordena a transação e audita sem dados de cliente', async () => {
    const result = await service.create(dto, u);
    expect(result).toMatchObject({ ...dto, vendedorId: 'v', status: 'ATIVA' });
    expect(lotes.reservar).toHaveBeenCalledWith('l', 'v', tx);
    expect(clientes.validarExistencia).toHaveBeenCalledWith('c', tx);
    expect(JSON.stringify(audit.registrar.mock.calls)).not.toContain(
      'clienteId',
    );
  });
  it('nega Consulta antes de gravar', async () => {
    await expect(
      service.create(dto, { ...u, perfil: 'CONSULTA' }),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('consulta própria e nega outro vendedor ou recurso ausente', async () => {
    repository.findById.mockResolvedValue(
      Reserva.create({ ...dto, vendedorId: 'v' }, 7),
    );
    expect((await service.findById('r', u, tx)).vendedorId).toBe('v');
    expect(repository.findById).toHaveBeenCalledWith('r', tx);
    await expect(
      service.findById('r', { ...u, id: 'outro' }),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    repository.findById.mockResolvedValue(null);
    await expect(service.findById('r', u)).rejects.toMatchObject({
      code: 'RESERVA_NAO_ENCONTRADA',
    });
    await expect(
      service.findById('r', { ...u, perfil: 'CONSULTA' }),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
  });
  describe('venda de lote', () => {
    const gestor = { ...u, perfil: 'GESTOR' as const };

    it('nega Comercial antes de bloquear a reserva', async () => {
      await expect(service.venderLote('l', u)).rejects.toMatchObject({
        code: 'ACESSO_NEGADO',
      });
      expect(repository.travarAtivaPorLote).not.toHaveBeenCalled();
    });

    it('distingue lote existente sem reserva ativa', async () => {
      repository.travarAtivaPorLote.mockResolvedValue(null);
      await expect(service.venderLote('l', gestor)).rejects.toMatchObject({
        code: 'LOTE_SEM_RESERVA_ATIVA',
      });
      expect(lotes.findById).toHaveBeenCalledWith('l', tx);
    });

    it('não vende sem proposta aprovada na reserva bloqueada', async () => {
      repository.travarAtivaPorLote.mockResolvedValue('r');
      repository.findPropostaAprovada.mockResolvedValue(null);
      await expect(service.venderLote('l', gestor)).rejects.toMatchObject({
        code: 'LOTE_SEM_PROPOSTA_APROVADA',
      });
      expect(repository.findPropostaAprovada).toHaveBeenCalledWith('r', tx);
      expect(lotes.vender).not.toHaveBeenCalled();
    });

    it('usa a mesma transação na venda, conversão e auditoria', async () => {
      repository.travarAtivaPorLote.mockResolvedValue('r');
      repository.findPropostaAprovada.mockResolvedValue('p');
      await service.venderLote('l', { ...u, perfil: 'ADMINISTRADOR' });
      expect(lotes.vender).toHaveBeenCalledWith('l', u.id, tx);
      expect(repository.converter).toHaveBeenCalledWith('r', tx);
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          entidadeId: 'r',
          acao: 'CONVERTER',
          valorNovo: { status: 'CONVERTIDA', loteId: 'l', propostaId: 'p' },
        }),
        tx,
      );
    });
  });

  it('propaga falha de auditoria para rollback', async () => {
    audit.registrar.mockRejectedValue(new Error('falha'));
    await expect(service.create(dto, u)).rejects.toThrow('falha');
  });
});
