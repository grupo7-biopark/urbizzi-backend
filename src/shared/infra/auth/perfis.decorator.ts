import { SetMetadata } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../domain/usuario-autenticado.js';
export const PERFIS_KEY = 'perfis';
/** Lista explícita; no método substitui a lista do controller. Lista vazia nega todos. */
export const Perfis = (...perfis: UsuarioAutenticado['perfil'][]) =>
  SetMetadata(PERFIS_KEY, [...perfis]);
