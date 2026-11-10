export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  perfil: 'ADMINISTRADOR' | 'GESTOR' | 'COMERCIAL' | 'CONSULTA';
}
export interface CredencialAutenticada {
  usuario: UsuarioAutenticado;
  expiraEmMs: number;
}

export const AUTENTICADOR = Symbol('AUTENTICADOR');
export interface Autenticador {
  autenticarToken(token: string): Promise<CredencialAutenticada>;
}
