import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { AuthService } from './auth.service.js';
import type { UsuarioService } from '../../../usuarios/application/services/usuario.service.js';
import { Sessao } from '../../domain/models/sessao.entity.js';
describe('AuthService', () => {
  const usuario = {
    id: 'u',
    nome: 'Teste',
    email: 'teste@exemplo.com',
    perfil: 'COMERCIAL' as const,
  };
  const usuarios = {
    autenticar: vi.fn(),
    findAtivoById: vi.fn(),
    bloquearAutenticacao: vi.fn(),
  };
  const tx = {} as PrismaTransaction;
  const transactions = {
    run: (fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx),
  } as TransactionManager;
  const sessoes = {
    create: vi.fn(),
    findValida: vi.fn(),
    rotate: vi.fn(),
    revoke: vi.fn(),
  };
  const tokens = {
    expiresIn: 900,
    refreshExpiresIn: 604800,
    sign: vi.fn(),
    verify: vi.fn(),
  };
  let service: AuthService;
  beforeEach(() => {
    vi.resetAllMocks();
    usuarios.autenticar.mockResolvedValue(usuario);
    usuarios.findAtivoById.mockResolvedValue(usuario);
    tokens.sign.mockResolvedValue('jwt');
    tokens.verify.mockImplementation(async () => ({
      usuarioId: 'u',
      expiraEmMs: Date.now() + 900_000,
    }));
    sessoes.rotate.mockResolvedValue(true);
    service = new AuthService(
      usuarios as unknown as UsuarioService,
      sessoes,
      tokens,
      transactions,
    );
  });
  it('inicia sessão e retorna tokens', async () => {
    const result = await service.login({
      email: usuario.email,
      senha: 'senha',
    });
    expect(result).toMatchObject({
      accessToken: 'jwt',
      expiresIn: 900,
      tokenType: 'Bearer',
    });
    expect(sessoes.create.mock.calls[0][0].tokenHash).toBe(
      Sessao.hashToken(result.refreshToken),
    );
  });
  it('rejeita credenciais sem indicar se usuário existe', async () => {
    usuarios.autenticar.mockResolvedValue(null);
    await expect(
      service.login({ email: usuario.email, senha: 'errada' }),
    ).rejects.toMatchObject({ code: 'CREDENCIAIS_INVALIDAS' });
    expect(sessoes.create).not.toHaveBeenCalled();
  });
  it('rotaciona refresh token', async () => {
    sessoes.findValida.mockResolvedValue(Sessao.create('u', 3600).sessao);
    const result = await service.refresh('antigo');
    expect(result.accessToken).toBe('jwt');
    expect(result.refreshToken).not.toBe('antigo');
    expect(sessoes.rotate).toHaveBeenCalledWith(
      Sessao.hashToken('antigo'),
      expect.any(Sessao),
      tx,
    );
  });
  it.each(['ausente', 'inativo', 'concorrente'])(
    'nega refresh %s',
    async (caso) => {
      sessoes.findValida.mockResolvedValue(
        caso === 'ausente' ? null : Sessao.create('u', 3600).sessao,
      );
      if (caso === 'inativo') usuarios.findAtivoById.mockResolvedValue(null);
      if (caso === 'concorrente') sessoes.rotate.mockResolvedValue(false);
      await expect(service.refresh('antigo')).rejects.toMatchObject({
        code: 'REFRESH_TOKEN_INVALIDO',
      });
    },
  );
  it('revoga somente o hash informado', async () => {
    await service.logout('token');
    expect(sessoes.revoke).toHaveBeenCalledWith(Sessao.hashToken('token'));
  });
  it('autentica consultando usuário atual', async () => {
    expect(await service.autenticarToken('jwt')).toEqual({
      usuario,
      expiraEmMs: expect.any(Number),
    });
    expect(usuarios.findAtivoById).toHaveBeenCalledWith(usuario.id);
  });
  it('recusa credencial que expira enquanto o usuário é consultado', async () => {
    tokens.verify.mockResolvedValue({ usuarioId: 'u', expiraEmMs: Date.now() });
    await expect(service.autenticarToken('jwt')).rejects.toMatchObject({
      code: 'NAO_AUTENTICADO',
    });
  });
  it.each(['token', 'usuario'])('nega acesso inválido: %s', async (caso) => {
    if (caso === 'token') tokens.verify.mockResolvedValue(null);
    else usuarios.findAtivoById.mockResolvedValue(null);
    await expect(service.autenticarToken('jwt')).rejects.toMatchObject({
      code: 'NAO_AUTENTICADO',
    });
  });
});
