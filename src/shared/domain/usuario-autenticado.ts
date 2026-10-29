export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  perfil: 'ADMINISTRADOR' | 'GESTOR' | 'COMERCIAL' | 'CONSULTA';
}
export const AUTENTICADOR = Symbol('AUTENTICADOR');
export interface Autenticador {
  autenticarToken(token: string): Promise<UsuarioAutenticado>;
}
