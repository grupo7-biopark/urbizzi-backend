import { LinkPublicoService } from './link-publico.service.js';
import { LinkPublico } from '../../domain/models/link-publico.entity.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import type { LoteamentoService } from '../../../loteamentos/application/services/loteamento.service.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
describe('LinkPublicoService', () => {
  const repository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    desativar: vi.fn(),
    registrarAcesso: vi.fn(),
  };
  const audit = { registrar: vi.fn() };
  const loteamentos = { findById: vi.fn() };
  const usuario = {
    id: 'u',
    perfil: 'COMERCIAL',
    nome: 'Teste',
    email: 'teste@exemplo.com',
  } as UsuarioAutenticado;
  let service: LinkPublicoService;
  beforeEach(() => {
    vi.resetAllMocks();
    service = new LinkPublicoService(
      repository,
      {
        run: async (fn: (tx: object) => Promise<unknown>) => fn({}),
      } as TransactionManager,
      audit as unknown as AuditoriaService,
      loteamentos as unknown as LoteamentoService,
    );
  });
  it('cria escopo opcional e audita sem token', async () => {
    const link = await service.create({}, usuario);
    expect(link.loteamentoId).toBeNull();
    expect(JSON.stringify(audit.registrar.mock.calls)).not.toContain(
      link.token,
    );
    await service.create({ loteamentoId: 'l' }, usuario);
    expect(loteamentos.findById).toHaveBeenCalledWith('l');
  });
  it('filtra listagem do Comercial e permite visão geral de gestores', async () => {
    repository.list.mockResolvedValue({
      items: [LinkPublico.create('u')],
      total: 1,
    });
    expect(
      (await service.list({ page: 1, pageSize: 20 }, usuario)).meta.total,
    ).toBe(1);
    expect(repository.list).toHaveBeenLastCalledWith('u', expect.anything());
    await service.list(
      { page: 1, pageSize: 20 },
      { ...usuario, perfil: 'GESTOR' },
    );
    expect(repository.list).toHaveBeenLastCalledWith(
      undefined,
      expect.anything(),
    );
  });
  it('desativa recurso próprio uma vez e respeita propriedade', async () => {
    const link = LinkPublico.create('u');
    repository.findById.mockResolvedValue(link);
    repository.desativar.mockResolvedValue(true);
    expect((await service.desativar(link.dados.id, usuario)).ativo).toBe(false);
    await service.desativar(link.dados.id, usuario);
    expect(audit.registrar).toHaveBeenCalledOnce();
    repository.findById.mockResolvedValue(LinkPublico.create('outro'));
    await expect(service.desativar('id', usuario)).rejects.toMatchObject({
      code: 'ACESSO_NEGADO',
    });
  });
  it('não duplica auditoria ao perder corrida de desativação e nega ausente', async () => {
    repository.findById.mockResolvedValue(LinkPublico.create('u'));
    repository.desativar.mockResolvedValue(false);
    await service.desativar('id', usuario);
    expect(audit.registrar).not.toHaveBeenCalled();
    repository.findById.mockResolvedValue(null);
    await expect(service.desativar('id', usuario)).rejects.toMatchObject({
      code: 'LINK_NAO_ENCONTRADO',
    });
  });
  it('nega Consulta e tokens inválidos/inativos; registra acesso válido', async () => {
    await expect(
      service.create({}, { ...usuario, perfil: 'CONSULTA' }),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    await expect(
      service.list(
        { page: 1, pageSize: 20 },
        { ...usuario, perfil: 'CONSULTA' },
      ),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    await expect(service.registrarAcesso('invalido')).rejects.toMatchObject({
      code: 'LINK_NAO_ENCONTRADO',
    });
    repository.registrarAcesso.mockResolvedValue(null);
    await expect(service.registrarAcesso('a'.repeat(43))).rejects.toMatchObject(
      { code: 'LINK_NAO_ENCONTRADO' },
    );
    repository.registrarAcesso.mockResolvedValue(LinkPublico.create('u'));
    expect((await service.registrarAcesso('a'.repeat(43))).ativo).toBe(true);
  });
});
