import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Loteamento } from '../../domain/models/loteamento.entity.js';
import type { LoteamentoRepository } from '../../domain/repositories/loteamento.repository.interface.js';
import { LoteamentoService } from './loteamento.service.js';

describe('LoteamentoService', () => {
  const usuario: UsuarioAutenticado = {
    id: 'usuario-id',
    nome: 'Gestor',
    email: 'gestor@exemplo.com',
    perfil: 'GESTOR',
  };
  const tx = { transacao: true };
  let repository: {
    [K in keyof LoteamentoRepository]: ReturnType<typeof vi.fn>;
  };
  let auditoria: { registrar: ReturnType<typeof vi.fn> };
  let service: LoteamentoService;

  beforeEach(() => {
    repository = {
      travarExistentes: vi.fn(),
      findById: vi.fn(),
      existsByNome: vi.fn().mockResolvedValue(false),
      findByNomes: vi.fn(),
      hasQuadras: vi.fn().mockResolvedValue(false),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    auditoria = { registrar: vi.fn() };
    const transactionManager = {
      run: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    service = new LoteamentoService(
      repository as unknown as LoteamentoRepository,
      transactionManager as unknown as TransactionManager,
      auditoria as unknown as AuditoriaService,
    );
  });

  function existente(): Loteamento {
    const loteamento = Loteamento.create({
      nome: 'Bela Vista',
      descricao: 'Perto do centro',
    });
    repository.findById.mockResolvedValue(loteamento);
    return loteamento;
  }

  describe('create', () => {
    it('cria, audita na mesma transação e devolve o DTO', async () => {
      const dto = await service.create({ nome: 'Bela Vista' }, usuario);

      expect(dto).toMatchObject({ nome: 'Bela Vista', descricao: null });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: dto.id }),
        tx,
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        {
          usuarioId: usuario.id,
          entidadeTipo: 'Loteamento',
          entidadeId: dto.id,
          acao: 'CRIAR',
          valorNovo: {
            nome: 'Bela Vista',
            descricao: null,
            localizacao: null,
          },
        },
        tx,
      );
    });

    it('lança ConflictError quando o nome já existe', async () => {
      repository.existsByNome.mockResolvedValue(true);

      await expect(
        service.create({ nome: 'Bela Vista' }, usuario),
      ).rejects.toMatchObject({
        constructor: ConflictError,
        code: 'LOTEAMENTO_JA_EXISTE',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('devolve o DTO do loteamento', async () => {
      const loteamento = existente();

      await expect(service.findById(loteamento.id)).resolves.toMatchObject({
        id: loteamento.id,
      });
    });

    it('lança NotFoundError quando o loteamento não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('id')).rejects.toMatchObject({
        constructor: NotFoundError,
        code: 'LOTEAMENTO_NAO_ENCONTRADO',
      });
    });
  });

  it('lista com filtros e paginação', async () => {
    const loteamento = Loteamento.create({ nome: 'Bela Vista' });
    repository.list.mockResolvedValue({ items: [loteamento], total: 21 });

    const result = await service.list({ page: 2, pageSize: 20, q: 'bela' });

    expect(repository.list).toHaveBeenCalledWith(
      { q: 'bela' },
      { page: 2, pageSize: 20 },
    );
    expect(result.data[0].id).toBe(loteamento.id);
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });
  });

  describe('update', () => {
    it('atualiza e audita os valores anterior e novo', async () => {
      const loteamento = existente();

      const dto = await service.update(
        loteamento.id,
        { nome: 'Novo Nome', descricao: null },
        usuario,
      );

      expect(dto).toMatchObject({ nome: 'Novo Nome', descricao: null });
      expect(repository.existsByNome).toHaveBeenCalledWith(
        'Novo Nome',
        loteamento.id,
      );
      expect(repository.update).toHaveBeenCalledWith(loteamento, tx);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'ALTERAR',
          valorAnterior: {
            nome: 'Bela Vista',
            descricao: 'Perto do centro',
            localizacao: null,
          },
          valorNovo: { nome: 'Novo Nome', descricao: null, localizacao: null },
        }),
        tx,
      );
    });

    it('não verifica o nome quando ele não é alterado', async () => {
      const loteamento = existente();

      await service.update(loteamento.id, { localizacao: 'Toledo' }, usuario);

      expect(repository.existsByNome).not.toHaveBeenCalled();
    });

    it('lança ConflictError quando o novo nome já existe', async () => {
      const loteamento = existente();
      repository.existsByNome.mockResolvedValue(true);

      await expect(
        service.update(loteamento.id, { nome: 'Outro' }, usuario),
      ).rejects.toMatchObject({ code: 'LOTEAMENTO_JA_EXISTE' });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundError quando o loteamento não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('id', { nome: 'Outro' }, usuario),
      ).rejects.toMatchObject({ code: 'LOTEAMENTO_NAO_ENCONTRADO' });
    });
  });

  describe('delete', () => {
    it('exclui e audita o valor anterior', async () => {
      const loteamento = existente();

      await service.delete(loteamento.id, usuario);

      expect(repository.hasQuadras).toHaveBeenCalledWith(loteamento.id, tx);
      expect(repository.delete).toHaveBeenCalledWith(loteamento.id, tx);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'EXCLUIR',
          entidadeId: loteamento.id,
          valorAnterior: loteamento.auditoria,
        }),
        tx,
      );
    });

    it('lança ConflictError quando há quadras cadastradas', async () => {
      const loteamento = existente();
      repository.hasQuadras.mockResolvedValue(true);

      await expect(
        service.delete(loteamento.id, usuario),
      ).rejects.toMatchObject({
        constructor: ConflictError,
        code: 'LOTEAMENTO_COM_QUADRAS',
      });
      expect(repository.delete).not.toHaveBeenCalled();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });

    it('lança NotFoundError quando o loteamento não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('id', usuario)).rejects.toMatchObject({
        code: 'LOTEAMENTO_NAO_ENCONTRADO',
      });
    });
  });
});
