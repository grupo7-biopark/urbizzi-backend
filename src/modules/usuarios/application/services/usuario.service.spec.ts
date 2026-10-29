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
  const repository = { findByEmail: vi.fn(), findById: vi.fn() };
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
    expect(repository.findByEmail).toHaveBeenCalledWith('teste@exemplo.com');
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
});
