import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../../shared/application/auth/password-hasher.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import {
  USUARIO_REPOSITORY,
  type UsuarioRepository,
} from '../../domain/repositories/usuario.repository.interface.js';
@Injectable()
export class UsuarioService {
  private readonly dummyHash: Promise<string>;
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {
    this.dummyHash = hasher.hash(randomBytes(32).toString('hex'));
  }
  async autenticar(
    email: string,
    senha: string,
  ): Promise<UsuarioAutenticado | null> {
    const usuario = await this.repository.findByEmail(
      email.trim().toLowerCase(),
    );
    const valido = await this.hasher.verify(
      usuario?.senhaHash ?? (await this.dummyHash),
      senha,
    );
    return usuario?.ativo && valido ? usuario.dados : null;
  }
  async findAtivoById(id: string): Promise<UsuarioAutenticado | null> {
    const usuario = await this.repository.findById(id);
    return usuario?.ativo ? usuario.dados : null;
  }
}
