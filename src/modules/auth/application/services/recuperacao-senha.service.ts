import { Inject, Injectable } from '@nestjs/common';
import {
  EMAIL,
  type Email,
} from '../../../../shared/application/email/email.interface.js';
import { AuthenticationError } from '../../../../shared/domain/errors/domain.error.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { UsuarioService } from '../../../usuarios/application/services/usuario.service.js';
import { TokenRecuperacaoSenha } from '../../domain/models/token-recuperacao-senha.entity.js';
import {
  RECUPERACAO_SENHA_REPOSITORY,
  type RecuperacaoSenhaRepository,
} from '../../domain/repositories/recuperacao-senha.repository.interface.js';
@Injectable()
export class RecuperacaoSenhaService {
  constructor(
    private readonly usuarios: UsuarioService,
    @Inject(RECUPERACAO_SENHA_REPOSITORY)
    private readonly repository: RecuperacaoSenhaRepository,
    @Inject(EMAIL) private readonly email: Email,
    private readonly transactions: TransactionManager,
  ) {}
  async solicitar(email: string): Promise<void> {
    const usuario = await this.usuarios.findAtivoByEmail(email);
    if (!usuario) return;
    const { entidade, token } = TokenRecuperacaoSenha.create(usuario.id);
    await this.repository.create(entidade);
    // Falhas do provedor não podem revelar a existência da conta pela resposta HTTP.
    try {
      await this.email.enviarRecuperacao(usuario.email, token);
    } catch {
      /* O usuário pode solicitar outro link. Não registrar destinatário nem token. */
    }
  }
  async redefinir(token: string, senha: string): Promise<void> {
    // Argon2 é calculado antes da transação para manter os locks curtos.
    const hash = await this.usuarios.gerarSenhaHash(senha);
    await this.transactions.run(async (tx) => {
      const tokenHash = TokenRecuperacaoSenha.hashToken(token);
      const entidade = await this.repository.findByHash(tokenHash, tx);
      if (!entidade?.isValido()) this.invalido();
      // A atualização do usuário serializa redefinições com tokens diferentes.
      // Se o consumo falhar, a alteração da senha também sofre rollback.
      if (!(await this.usuarios.redefinirSenha(entidade.usuarioId, hash, tx)))
        this.invalido();
      if (!(await this.repository.consumir(tokenHash, tx))) this.invalido();
      await this.repository.invalidarTodos(entidade.usuarioId, tx);
    });
  }
  private invalido(): never {
    throw new AuthenticationError(
      'TOKEN_RECUPERACAO_INVALIDO',
      'Token de recuperação inválido ou expirado',
    );
  }
}
