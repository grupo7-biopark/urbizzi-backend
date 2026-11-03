import { RecuperacaoSenhaService } from './recuperacao-senha.service.js';
import { TokenRecuperacaoSenha } from '../../domain/models/token-recuperacao-senha.entity.js';
import type { UsuarioService } from '../../../usuarios/application/services/usuario.service.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
describe('RecuperacaoSenhaService', () => {
  const usuarios = {
    findAtivoByEmail: vi.fn(),
    gerarSenhaHash: vi.fn(),
    redefinirSenha: vi.fn(),
  };
  const repository = {
    create: vi.fn(),
    findByHash: vi.fn(),
    consumir: vi.fn(),
    invalidarTodos: vi.fn(),
  };
  const email = { enviarRecuperacao: vi.fn() };
  const tx = {} as PrismaTransaction;
  const transactions = {
    run: (fn: (tx: PrismaTransaction) => Promise<void>) => fn(tx),
  };
  let service: RecuperacaoSenhaService;
  beforeEach(() => {
    vi.resetAllMocks();
    service = new RecuperacaoSenhaService(
      usuarios as unknown as UsuarioService,
      repository,
      email,
      transactions as TransactionManager,
    );
    usuarios.gerarSenhaHash.mockResolvedValue('hash-novo');
    usuarios.redefinirSenha.mockResolvedValue(true);
    repository.consumir.mockResolvedValue(true);
  });
  it('persiste só hash e envia token ao e-mail cadastrado', async () => {
    usuarios.findAtivoByEmail.mockResolvedValue({
      id: 'id',
      email: 'teste@exemplo.com',
    });
    await service.solicitar('teste@exemplo.com');
    const [destinatario, token] = email.enviarRecuperacao.mock.calls[0];
    expect(destinatario).toBe('teste@exemplo.com');
    expect(repository.create.mock.calls[0][0].tokenHash).toBe(
      TokenRecuperacaoSenha.hashToken(token),
    );
  });
  it('responde igualmente para usuário inexistente ou inativo', async () => {
    usuarios.findAtivoByEmail.mockResolvedValue(null);
    await expect(
      service.solicitar('ausente@exemplo.com'),
    ).resolves.toBeUndefined();
    expect(email.enviarRecuperacao).not.toHaveBeenCalled();
  });
  it('não expõe falha SMTP na resposta de solicitação', async () => {
    usuarios.findAtivoByEmail.mockResolvedValue({
      id: 'id',
      email: 'teste@exemplo.com',
    });
    email.enviarRecuperacao.mockRejectedValue(new Error('SMTP'));
    await expect(
      service.solicitar('teste@exemplo.com'),
    ).resolves.toBeUndefined();
  });
  it('consome token, altera senha e invalida recuperações e sessões na mesma transação', async () => {
    repository.findByHash.mockResolvedValue(
      TokenRecuperacaoSenha.create('id').entidade,
    );
    await service.redefinir('token', 'NovaSenha123!');
    expect(repository.consumir).toHaveBeenCalledWith(
      TokenRecuperacaoSenha.hashToken('token'),
      tx,
    );
    expect(usuarios.redefinirSenha).toHaveBeenCalledWith('id', 'hash-novo', tx);
    expect(repository.invalidarTodos).toHaveBeenCalledWith('id', tx);
  });
  it.each(['ausente', 'expirado', 'usado', 'concorrente', 'inativo'])(
    'rejeita token %s',
    async (caso) => {
      const entidade = TokenRecuperacaoSenha.create('id').entidade;
      repository.findByHash.mockResolvedValue(
        caso === 'ausente'
          ? null
          : caso === 'expirado' || caso === 'usado'
            ? TokenRecuperacaoSenha.restore({
                id: 'id',
                usuarioId: 'id',
                tokenHash: 'hash',
                expiraEm: caso === 'expirado' ? new Date(0) : entidade.expiraEm,
                usadoEm: caso === 'usado' ? new Date() : null,
              })
            : entidade,
      );
      repository.consumir.mockResolvedValue(caso !== 'concorrente');
      usuarios.redefinirSenha.mockResolvedValue(caso !== 'inativo');
      await expect(
        service.redefinir('token', 'NovaSenha123!'),
      ).rejects.toMatchObject({
        code: 'TOKEN_RECUPERACAO_INVALIDO',
        message: 'Token de recuperação inválido ou expirado',
      });
      expect(repository.invalidarTodos).not.toHaveBeenCalled();
    },
  );
});
