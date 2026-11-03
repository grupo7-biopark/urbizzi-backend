import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Loteamento } from '../../domain/models/loteamento.entity.js';
import { Quadra } from '../../domain/models/quadra.entity.js';
import type { LoteamentoRepository } from '../../domain/repositories/loteamento.repository.interface.js';
import type { QuadraRepository } from '../../domain/repositories/quadra.repository.interface.js';
import { QuadraService } from './quadra.service.js';

describe('QuadraService', () => {
  const usuario: UsuarioAutenticado = {
    id: 'usuario-id',
    nome: 'Gestor',
    email: 'gestor@exemplo.com',
    perfil: 'GESTOR',
  };
  const tx = { transacao: true };
  const loteamento = Loteamento.create({ nome: 'Bela Vista' });
  let repository: { [K in keyof QuadraRepository]: ReturnType<typeof vi.fn> };
  let loteamentos: { findById: ReturnType<typeof vi.fn> };
  let auditoria: { registrar: ReturnType<typeof vi.fn> };
  let service: QuadraService;

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      existsByNumero: vi.fn().mockResolvedValue(false),
      hasLotes: vi.fn().mockResolvedValue(false),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    loteamentos = { findById: vi.fn().mockResolvedValue(loteamento) };
    auditoria = { registrar: vi.fn() };
    service = new QuadraService(
      repository as unknown as QuadraRepository,
      loteamentos as unknown as LoteamentoRepository,
      {
        run: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
      } as unknown as TransactionManager,
      auditoria as unknown as AuditoriaService,
    );
  });

  function existente(): Quadra {
    const quadra = Quadra.create({ loteamentoId: loteamento.id, numero: 'A' });
    repository.findById.mockResolvedValue(quadra);
    return quadra;
  }

  describe('create', () => {
    it('cria no loteamento, audita na transação e devolve o DTO', async () => {
      const dto = await service.create(loteamento.id, { numero: 'A' }, usuario);

      expect(dto).toMatchObject({ loteamentoId: loteamento.id, numero: 'A' });
      expect(repository.existsByNumero).toHaveBeenCalledWith(
        loteamento.id,
        'A',
        undefined,
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: dto.id }),
        tx,
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        {
          usuarioId: usuario.id,
          entidadeTipo: 'Quadra',
          entidadeId: dto.id,
          acao: 'CRIAR',
          valorNovo: { loteamentoId: loteamento.id, numero: 'A' },
        },
        tx,
      );
    });

    it('lança NotFoundError quando o loteamento não existe', async () => {
      loteamentos.findById.mockResolvedValue(null);

      await expect(
        service.create('id', { numero: 'A' }, usuario),
      ).rejects.toMatchObject({
        constructor: NotFoundError,
        code: 'LOTEAMENTO_NAO_ENCONTRADO',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('lança ConflictError quando o número já existe no loteamento', async () => {
      repository.existsByNumero.mockResolvedValue(true);

      await expect(
        service.create(loteamento.id, { numero: 'A' }, usuario),
      ).rejects.toMatchObject({
        constructor: ConflictError,
        code: 'QUADRA_JA_EXISTE',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('devolve o DTO da quadra', async () => {
      const quadra = existente();

      await expect(service.findById(quadra.id)).resolves.toMatchObject({
        id: quadra.id,
      });
    });

    it('lança NotFoundError quando a quadra não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('id')).rejects.toMatchObject({
        constructor: NotFoundError,
        code: 'QUADRA_NAO_ENCONTRADA',
      });
    });
  });

  describe('list', () => {
    it('lista as quadras do loteamento com filtros e paginação', async () => {
      const quadra = Quadra.create({
        loteamentoId: loteamento.id,
        numero: 'A',
      });
      repository.list.mockResolvedValue({ items: [quadra], total: 1 });

      const result = await service.list(loteamento.id, {
        page: 1,
        pageSize: 20,
        q: 'a',
      });

      expect(repository.list).toHaveBeenCalledWith(
        { q: 'a', loteamentoId: loteamento.id },
        { page: 1, pageSize: 20 },
      );
      expect(result.data.map((q) => q.id)).toEqual([quadra.id]);
      expect(result.meta.total).toBe(1);
    });

    it('lança NotFoundError quando o loteamento não existe', async () => {
      loteamentos.findById.mockResolvedValue(null);

      await expect(
        service.list('id', { page: 1, pageSize: 20 }),
      ).rejects.toMatchObject({ code: 'LOTEAMENTO_NAO_ENCONTRADO' });
    });
  });

  describe('update', () => {
    it('altera o número e audita valores anterior e novo', async () => {
      const quadra = existente();

      const dto = await service.update(quadra.id, { numero: 'B' }, usuario);

      expect(dto.numero).toBe('B');
      expect(repository.existsByNumero).toHaveBeenCalledWith(
        loteamento.id,
        'B',
        quadra.id,
      );
      expect(repository.update).toHaveBeenCalledWith(quadra, tx);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'ALTERAR',
          valorAnterior: { loteamentoId: loteamento.id, numero: 'A' },
          valorNovo: { loteamentoId: loteamento.id, numero: 'B' },
        }),
        tx,
      );
    });

    it('não verifica o número quando ele não é informado', async () => {
      const quadra = existente();

      await service.update(quadra.id, {}, usuario);

      expect(repository.existsByNumero).not.toHaveBeenCalled();
    });

    it('lança ConflictError quando o novo número já existe', async () => {
      const quadra = existente();
      repository.existsByNumero.mockResolvedValue(true);

      await expect(
        service.update(quadra.id, { numero: 'B' }, usuario),
      ).rejects.toMatchObject({ code: 'QUADRA_JA_EXISTE' });
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('exclui e audita o valor anterior', async () => {
      const quadra = existente();

      await service.delete(quadra.id, usuario);

      expect(repository.hasLotes).toHaveBeenCalledWith(quadra.id, tx);
      expect(repository.delete).toHaveBeenCalledWith(quadra.id, tx);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'EXCLUIR',
          valorAnterior: quadra.auditoria,
        }),
        tx,
      );
    });

    it('lança ConflictError quando há lotes cadastrados', async () => {
      const quadra = existente();
      repository.hasLotes.mockResolvedValue(true);

      await expect(service.delete(quadra.id, usuario)).rejects.toMatchObject({
        constructor: ConflictError,
        code: 'QUADRA_COM_LOTES',
      });
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('lança NotFoundError quando a quadra não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('id', usuario)).rejects.toMatchObject({
        code: 'QUADRA_NAO_ENCONTRADA',
      });
    });
  });
});
