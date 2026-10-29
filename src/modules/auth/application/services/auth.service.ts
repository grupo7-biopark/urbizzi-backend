import { Inject, Injectable } from '@nestjs/common';
import { AuthenticationError } from '../../../../shared/domain/errors/domain.error.js';
import type {
  Autenticador,
  UsuarioAutenticado,
} from '../../../../shared/domain/usuario-autenticado.js';
import { UsuarioService } from '../../../usuarios/application/services/usuario.service.js';
import { Sessao } from '../../domain/models/sessao.entity.js';
import {
  SESSAO_REPOSITORY,
  type SessaoRepository,
} from '../../domain/repositories/sessao.repository.interface.js';
import {
  ACCESS_TOKEN,
  type AccessToken,
} from '../../domain/repositories/access-token.interface.js';
import { TokensDto } from '../dto/tokens.dto.js';
@Injectable()
export class AuthService implements Autenticador {
  constructor(
    private readonly usuarios: UsuarioService,
    @Inject(SESSAO_REPOSITORY) private readonly sessoes: SessaoRepository,
    @Inject(ACCESS_TOKEN) private readonly tokens: AccessToken,
  ) {}
  async login(input: { email: string; senha: string }): Promise<TokensDto> {
    const usuario = await this.usuarios.autenticar(input.email, input.senha);
    if (!usuario)
      throw new AuthenticationError(
        'CREDENCIAIS_INVALIDAS',
        'E-mail ou senha inválidos',
      );
    const { sessao, token } = Sessao.create(
      usuario.id,
      this.tokens.refreshExpiresIn,
    );
    const accessToken = await this.tokens.sign(usuario);
    await this.sessoes.create(sessao);
    return {
      accessToken,
      refreshToken: token,
      tokenType: 'Bearer',
      expiresIn: this.tokens.expiresIn,
    };
  }
  async refresh(token: string): Promise<TokensDto> {
    const hash = Sessao.hashToken(token);
    const antiga = await this.sessoes.findValida(hash);
    const usuario = antiga
      ? await this.usuarios.findAtivoById(antiga.usuarioId)
      : null;
    if (!usuario)
      throw new AuthenticationError(
        'REFRESH_TOKEN_INVALIDO',
        'Refresh token inválido ou expirado',
      );
    const nova = Sessao.create(usuario.id, this.tokens.refreshExpiresIn);
    const accessToken = await this.tokens.sign(usuario);
    if (!(await this.sessoes.rotate(hash, nova.sessao)))
      throw new AuthenticationError(
        'REFRESH_TOKEN_INVALIDO',
        'Refresh token inválido ou expirado',
      );
    return {
      accessToken,
      refreshToken: nova.token,
      tokenType: 'Bearer',
      expiresIn: this.tokens.expiresIn,
    };
  }
  async logout(token: string): Promise<void> {
    await this.sessoes.revoke(Sessao.hashToken(token));
  }
  async autenticarToken(token: string): Promise<UsuarioAutenticado> {
    const id = await this.tokens.verify(token);
    const usuario = id ? await this.usuarios.findAtivoById(id) : null;
    if (!usuario)
      throw new AuthenticationError(
        'NAO_AUTENTICADO',
        'Token inválido ou expirado',
      );
    return usuario;
  }
}
