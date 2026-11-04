import { GestaoUsuarioService } from './gestao-usuario.service.js';
import { Usuario } from '../../domain/models/usuario.entity.js';
import type { UsuarioService } from './usuario.service.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
describe('GestaoUsuarioService', () => {
  const tx = {} as PrismaTransaction;
  const usuarios = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    bloquearAutenticacao: vi.fn(),
    bloquearAutenticacaoPorEmail: vi.fn(),
    redefinirSenha: vi.fn(),
  };
  const repository = {
    list: vi.fn(),
    bloquearGestao: vi.fn(),
    countAdministradores: vi.fn(),
    save: vi.fn(),
  };
  const senhas = { gerarSenhaHash: vi.fn() };
  const auditoria = { registrar: vi.fn() };
  const transactions = {
    run: (fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx),
  } as TransactionManager;
  const props = {
    id: 'id',
    nome: 'Teste',
    email: 'teste@exemplo.com',
    perfil: 'ADMINISTRADOR' as const,
    ativo: true,
    senhaHash: 'hash',
  };
  const dto = {
    nome: 'Novo',
    email: ' NOVO@EXEMPLO.COM ',
    perfil: 'COMERCIAL' as const,
    senha: 'SenhaNova123!',
  };
  let service: GestaoUsuarioService;
  beforeEach(() => {
    vi.resetAllMocks();
    usuarios.findById.mockImplementation(async () => Usuario.restore(props));
    senhas.gerarSenhaHash.mockResolvedValue('hash');
    repository.countAdministradores.mockResolvedValue(1);
    service = new GestaoUsuarioService(
      usuarios,
      repository,
      senhas as unknown as UsuarioService,
      transactions,
      auditoria as unknown as AuditoriaService,
    );
  });
  it('cria com hash e auditoria sem dados pessoais', async () => {
    const result = await service.create(dto, 'ator');
    expect(result).toMatchObject({ email: 'novo@exemplo.com', ativo: true });
    expect(result).not.toHaveProperty('senhaHash');
    expect(JSON.stringify(auditoria.registrar.mock.calls)).not.toContain(
      'novo@exemplo.com',
    );
    expect(repository.save).toHaveBeenCalled();
  });
  it('rejeita e-mail duplicado na criação', async () => {
    usuarios.findByEmail.mockResolvedValue(Usuario.restore(props));
    await expect(service.create(dto, 'ator')).rejects.toMatchObject({
      code: 'USUARIO_EMAIL_DUPLICADO',
    });
  });
  it('lista paginado e encontra sem hash', async () => {
    repository.list.mockResolvedValue({
      items: [Usuario.restore(props)],
      total: 1,
    });
    expect((await service.list({ page: 1, pageSize: 20 })).meta.total).toBe(1);
    expect(await service.findById('id')).not.toHaveProperty('senhaHash');
  });
  it('nega detalhe e edição inexistentes', async () => {
    usuarios.findById.mockResolvedValue(null);
    await expect(service.findById('id')).rejects.toMatchObject({
      code: 'USUARIO_NAO_ENCONTRADO',
    });
    await expect(service.update('id', {}, 'ator')).rejects.toMatchObject({
      code: 'USUARIO_NAO_ENCONTRADO',
    });
  });
  it.each([false, undefined])(
    'protege último administrador: %s',
    async (ativo) => {
      const action =
        ativo === false
          ? service.definirAtivo('id', false, 'ator')
          : service.update('id', { perfil: 'CONSULTA' }, 'ator');
      await expect(action).rejects.toMatchObject({
        code: 'ULTIMO_ADMINISTRADOR',
      });
      expect(repository.save).not.toHaveBeenCalled();
    },
  );
  it('permite desativar quando há outro administrador e registra auditoria', async () => {
    repository.countAdministradores.mockResolvedValue(2);
    expect((await service.definirAtivo('id', false, 'ator')).ativo).toBe(false);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'DESATIVAR' }),
      tx,
    );
  });
  it('ativa usuário e preserva senha', async () => {
    usuarios.findById.mockResolvedValue(
      Usuario.restore({ ...props, ativo: false }),
    );
    expect((await service.definirAtivo('id', true, 'ator')).ativo).toBe(true);
  });
  it('edita dados normalizados e rejeita e-mail de outra conta', async () => {
    expect(
      (
        await service.update(
          'id',
          { email: ' TESTE@EXEMPLO.COM ', nome: ' Nome ' },
          'ator',
        )
      ).nome,
    ).toBe('Nome');
    usuarios.findByEmail.mockResolvedValue(
      Usuario.restore({ ...props, id: 'outro' }),
    );
    await expect(
      service.update('id', { email: 'outro@exemplo.com' }, 'ator'),
    ).rejects.toMatchObject({ code: 'USUARIO_EMAIL_DUPLICADO' });
  });
  it('propaga falha de auditoria para rollback', async () => {
    auditoria.registrar.mockRejectedValue(new Error('auditoria'));
    await expect(service.create(dto, 'ator')).rejects.toThrow('auditoria');
  });
});
