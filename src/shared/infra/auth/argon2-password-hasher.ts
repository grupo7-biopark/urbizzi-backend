import { Injectable } from '@nestjs/common';
import { hash, verify, argon2id } from 'argon2';
import type { PasswordHasher } from '../../application/auth/password-hasher.js';
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(senha: string): Promise<string> {
    return hash(senha, { type: argon2id });
  }
  async verify(hash: string, senha: string): Promise<boolean> {
    try {
      return await verify(hash, senha);
    } catch {
      return false;
    }
  }
}
