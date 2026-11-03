import { LoteService } from './lote.service.js';
import { Lote, type StatusLote } from '../../domain/models/lote.entity.js';
import type { LoteRepository } from '../../domain/repositories/lote.repository.interface.js';
import type { QuadraRepository } from '../../domain/repositories/quadra.repository.interface.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
describe('LoteService: bloqueio', () => {
  const repository = { findById: vi.fn(), alterarStatus: vi.fn() };
  const audit = { registrar: vi.fn() };
  let service: LoteService;
  const usuario = {
    id: 'u',
    perfil: 'GESTOR',
    nome: 'Teste',
    email: 'teste@exemplo.com',
  } as UsuarioAutenticado;
  const lote = (status: StatusLote) =>
    Lote.restore({
      id: 'l',
      quadraId: 'q',
      loteamentoId: 'lt',
      numero: '1',
      areaM2: '200.00',
      valor: null,
      exibirValorPublico: false,
      status,
      observacoes: null,
      teveReserva: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  beforeEach(() => {
    vi.resetAllMocks();
    service = new LoteService(
      repository as unknown as LoteRepository,
      {} as QuadraRepository,
      {
        run: async (fn: (tx: object) => Promise<unknown>) => fn({}),
      } as TransactionManager,
      audit as unknown as AuditoriaService,
    );
  });
  it('persiste transição condicional e audita motivo, anterior e novo status', async () => {
    repository.findById.mockResolvedValue(lote('DISPONIVEL'));
    expect(
      (await service.bloquear('l', { motivo: ' Motivo ' }, usuario)).status,
    ).toBe('BLOQUEADO');
    expect(repository.alterarStatus).toHaveBeenCalledWith(
      'l',
      'DISPONIVEL',
      'BLOQUEADO',
      expect.anything(),
    );
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        motivo: 'Motivo',
        valorAnterior: { status: 'DISPONIVEL' },
        valorNovo: { status: 'BLOQUEADO' },
      }),
      expect.anything(),
    );
    repository.findById.mockResolvedValue(lote('BLOQUEADO'));
    expect(
      (await service.desbloquear('l', { ...usuario, perfil: 'ADMINISTRADOR' }))
        .status,
    ).toBe('DISPONIVEL');
  });
  it('propaga corrida e não audita transição perdida', async () => {
    repository.findById.mockResolvedValue(lote('DISPONIVEL'));
    repository.alterarStatus.mockRejectedValue(new Error('Concorrência'));
    await expect(
      service.bloquear('l', { motivo: 'Motivo' }, usuario),
    ).rejects.toThrow('Concorrência');
    expect(audit.registrar).not.toHaveBeenCalled();
  });
  it('nega perfil, ausente e motivo ausente em chamadas internas', async () => {
    await expect(
      service.bloquear(
        'l',
        { motivo: 'Motivo' },
        { ...usuario, perfil: 'COMERCIAL' },
      ),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    repository.findById.mockResolvedValue(null);
    await expect(service.desbloquear('l', usuario)).rejects.toMatchObject({
      code: 'LOTE_NAO_ENCONTRADO',
    });
    repository.findById.mockResolvedValue(lote('DISPONIVEL'));
    await expect(
      service.bloquear(
        'l',
        { motivo: undefined as unknown as string },
        usuario,
      ),
    ).rejects.toMatchObject({ code: 'MOTIVO_OBRIGATORIO' });
  });
});
