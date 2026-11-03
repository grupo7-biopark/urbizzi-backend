import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Lote } from '../../domain/models/lote.entity.js';
import { Quadra } from '../../domain/models/quadra.entity.js';
import type { LoteRepository } from '../../domain/repositories/lote.repository.interface.js';
import type { QuadraRepository } from '../../domain/repositories/quadra.repository.interface.js';
import { LoteService } from './lote.service.js';

describe('LoteService', () => {
  const usuario: UsuarioAutenticado = {
    id: 'usuario-id',
    nome: 'Gestor',
    email: 'gestor@exemplo.com',
    perfil: 'GESTOR',
  };
  const tx = { transacao: true };
  const quadra = Quadra.create({
    loteamentoId: '0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10',
    numero: 'A',
  });
  let repository: { [K in keyof LoteRepository]: ReturnType<typeof vi.fn> };
  let quadras: { findById: ReturnType<typeof vi.fn> };
  let auditoria: { registrar: ReturnType<typeof vi.fn> };
  let service: LoteService;

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      existsByNumero: vi.fn().mockResolvedValue(false),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    quadras = { findById: vi.fn().mockResolvedValue(quadra) };
    auditoria = { registrar: vi.fn() };
    service = new LoteService(
      repository as unknown as LoteRepository,
      quadras as unknown as QuadraRepository,
      {
        run: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
      } as unknown as TransactionManager,
      auditoria as unknown as AuditoriaService,
    );
  });

  function existente(): Lote {
    const lote = Lote.create({
      quadraId: quadra.id,
      loteamentoId: quadra.loteamentoId,
      numero: '12',
      areaM2: '360',
      valor: '250000',
    });
    repository.findById.mockResolvedValue(lote);
    return lote;
  }

  describe('create', () => {
    it('cria DISPONIVEL no loteamento da quadra e audita', async () => {
      const dto = await service.create(
        { quadraId: quadra.id, numero: '12', areaM2: '360.5' },
        usuario,
      );

      expect(dto).toMatchObject({
        loteamentoId: quadra.loteamentoId,
        quadraId: quadra.id,
        areaM2: '360.50',
        valor: null,
        status: 'DISPONIVEL',
      });
      expect(repository.existsByNumero).toHaveBeenCalledWith(
        quadra.id,
        '12',
        undefined,
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: dto.id }),
        tx,
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: usuario.id,
          entidadeTipo: 'Lote',
          entidadeId: dto.id,
          acao: 'CRIAR',
          valorNovo: expect.objectContaining({
            numero: '12',
            areaM2: '360.50',
          }),
        }),
        tx,
      );
    });

    it('lança NotFoundError quando a quadra não existe', async () => {
      quadras.findById.mockResolvedValue(null);

      await expect(
        service.create({ quadraId: 'id', numero: '1', areaM2: '1' }, usuario),
      ).rejects.toMatchObject({
        constructor: NotFoundError,
        code: 'QUADRA_NAO_ENCONTRADA',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('lança ConflictError quando o número já existe na quadra', async () => {
      repository.existsByNumero.mockResolvedValue(true);

      await expect(
        service.create(
          { quadraId: quadra.id, numero: '12', areaM2: '1' },
          usuario,
        ),
      ).rejects.toMatchObject({
        constructor: ConflictError,
        code: 'LOTE_JA_EXISTE',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('devolve o DTO do lote', async () => {
      const lote = existente();

      await expect(service.findById(lote.id)).resolves.toMatchObject({
        id: lote.id,
        valor: '250000.00',
      });
    });

    it('lança NotFoundError quando o lote não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('id')).rejects.toMatchObject({
        constructor: NotFoundError,
        code: 'LOTE_NAO_ENCONTRADO',
      });
    });
  });

  it('repassa os filtros e a paginação', async () => {
    const lote = existente();
    repository.list.mockResolvedValue({ items: [lote], total: 1 });

    const result = await service.list({
      page: 1,
      pageSize: 20,
      loteamentoId: quadra.loteamentoId,
      status: ['DISPONIVEL'],
      q: '1',
    });

    expect(repository.list).toHaveBeenCalledWith(
      { loteamentoId: quadra.loteamentoId, status: ['DISPONIVEL'], q: '1' },
      { page: 1, pageSize: 20 },
    );
    expect(result.data.map((l) => l.id)).toEqual([lote.id]);
  });

  describe('update', () => {
    it('atualiza e audita a mudança de valor', async () => {
      const lote = existente();

      const dto = await service.update(
        lote.id,
        { valor: '260000', observacoes: 'Esquina' },
        usuario,
      );

      expect(dto).toMatchObject({ valor: '260000.00', observacoes: 'Esquina' });
      expect(repository.existsByNumero).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(lote, tx);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'ALTERAR',
          valorAnterior: expect.objectContaining({ valor: '250000.00' }),
          valorNovo: expect.objectContaining({ valor: '260000.00' }),
        }),
        tx,
      );
    });

    it('verifica o número novo na mesma quadra', async () => {
      const lote = existente();
      repository.existsByNumero.mockResolvedValue(true);

      await expect(
        service.update(lote.id, { numero: '13' }, usuario),
      ).rejects.toMatchObject({ code: 'LOTE_JA_EXISTE' });
      expect(repository.existsByNumero).toHaveBeenCalledWith(
        quadra.id,
        '13',
        lote.id,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundError quando o lote não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('id', { valor: '1' }, usuario),
      ).rejects.toMatchObject({ code: 'LOTE_NAO_ENCONTRADO' });
    });
  });

  describe('delete', () => {
    it('exclui lote disponível e audita', async () => {
      const lote = existente();

      await service.delete(lote.id, usuario);

      expect(repository.delete).toHaveBeenCalledWith(lote.id, tx);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'EXCLUIR',
          valorAnterior: lote.auditoria,
        }),
        tx,
      );
    });

    it('não exclui quando a regra da entidade impede', async () => {
      const lote = Lote.restore({
        ...existente().auditoria,
        id: 'id',
        loteamentoId: quadra.loteamentoId,
        status: 'RESERVADO',
        teveReserva: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repository.findById.mockResolvedValue(lote);

      await expect(service.delete(lote.id, usuario)).rejects.toMatchObject({
        code: 'LOTE_NAO_DISPONIVEL',
      });
      expect(repository.delete).not.toHaveBeenCalled();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });

    it('lança NotFoundError quando o lote não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('id', usuario)).rejects.toMatchObject({
        code: 'LOTE_NAO_ENCONTRADO',
      });
    });
  });
});
