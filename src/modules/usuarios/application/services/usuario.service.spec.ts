import { UsuarioService } from './usuario.service.js';
import { Usuario } from '../../domain/models/usuario.entity.js';
describe('UsuarioService', () => {
  const props = {
    id: 'id',
    nome: 'Teste',
    email: 'teste@exemplo.com',
    senhaHash: 'hash',
    ativo: true,
    perfil: 'COMERCIAL' as const,
  };
  const repository = {
    redefinirSenha: vi.fn(),
    bloquearAutenticacao: vi.fn(),
    bloquearAutenticacaoPorEmail: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
  };
  const hasher = { hash: vi.fn().mockResolvedValue('dummy'), verify: vi.fn() };
  let service: UsuarioService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsuarioService(repository, hasher);
  });
  it('normaliza e-mail, valida senha e remove campos internos', async () => {
    repository.findByEmail.mockResolvedValue(Usuario.restore(props));
    hasher.verify.mockResolvedValue(true);
    expect(await service.autenticar(' TESTE@EXEMPLO.COM ', 'senha')).toEqual({
      id: 'id',
      nome: 'Teste',
      email: 'teste@exemplo.com',
      perfil: 'COMERCIAL',
    });
    expect(repository.findByEmail).toHaveBeenCalledWith(
      'teste@exemplo.com',
      undefined,
    );
    expect(hasher.verify).toHaveBeenCalledWith('hash', 'senha');
  });
  it.each([
    null,
    Usuario.restore({ ...props, ativo: false }),
    Usuario.restore(props),
  ])('nega usuário inexistente, inativo ou senha errada', async (usuario) => {
    repository.findByEmail.mockResolvedValue(usuario);
    hasher.verify.mockResolvedValue(false);
    expect(await service.autenticar('teste@exemplo.com', 'senha')).toBeNull();
    expect(hasher.verify).toHaveBeenCalled();
  });
  it.each([null, Usuario.restore({ ...props, ativo: false })])(
    'não retorna usuário inativo ou ausente',
    async (usuario) => {
      repository.findById.mockResolvedValue(usuario);
      expect(await service.findAtivoById('id')).toBeNull();
    },
  );
  it('retorna dados atuais do usuário ativo', async () => {
    repository.findById.mockResolvedValue(Usuario.restore(props));
    expect(await service.findAtivoById('id')).toMatchObject({
      id: 'id',
      perfil: 'COMERCIAL',
    });
  });
  it('consulta por e-mail normalizado sem expor hash', async () => {
    repository.findByEmail.mockResolvedValue(Usuario.restore(props));
    const usuario = await service.findAtivoByEmail(' TESTE@EXEMPLO.COM ');
    expect(usuario).toMatchObject({ id: 'id' });
    expect(usuario).not.toHaveProperty('senhaHash');
    expect(repository.findByEmail).toHaveBeenCalledWith('teste@exemplo.com');
  });
  it.each([null, Usuario.restore({ ...props, ativo: false })])(
    'não recupera conta inexistente ou inativa',
    async (usuario) => {
      repository.findByEmail.mockResolvedValue(usuario);
      expect(await service.findAtivoByEmail('teste@exemplo.com')).toBeNull();
    },
  );
  it('gera hash e altera senha pela transação fornecida', async () => {
    const tx =
      {} as import('../../../../shared/infra/database/prisma.transaction.js').PrismaTransaction;
    hasher.hash.mockResolvedValue('novo-hash');
    repository.redefinirSenha.mockResolvedValue(true);
    expect(await service.gerarSenhaHash('nova')).toBe('novo-hash');
    expect(await service.redefinirSenha('id', 'novo-hash', tx)).toBe(true);
    expect(repository.redefinirSenha).toHaveBeenCalledWith(
      'id',
      'novo-hash',
      tx,
    );
  });

  it('autentica com leitura transacional depois de bloquear o usuário por e-mail', async () => {
    const tx =
      {} as import('../../../../shared/infra/database/prisma.transaction.js').PrismaTransaction;
    repository.findByEmail.mockResolvedValue(Usuario.restore(props));
    hasher.verify.mockResolvedValue(true);
    expect(
      await service.autenticar(' TESTE@EXEMPLO.COM ', 'senha', tx),
    ).toMatchObject({ id: 'id' });
    expect(repository.bloquearAutenticacaoPorEmail).toHaveBeenCalledWith(
      'teste@exemplo.com',
      tx,
    );
    expect(repository.findByEmail).toHaveBeenCalledWith(
      'teste@exemplo.com',
      tx,
    );
    await service.bloquearAutenticacao('id', tx);
    expect(repository.bloquearAutenticacao).toHaveBeenCalledWith('id', tx);
  });
});
