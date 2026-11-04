import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { ItemMapa } from '../repositories/mapa-consulta.repository.interface.js';
export type AcaoMapa =
  'reservar' | 'verReserva' | 'vender' | 'bloquear' | 'desbloquear';
export function acoesMapa(
  item: ItemMapa,
  usuario: UsuarioAutenticado,
): AcaoMapa[] {
  if (usuario.perfil === 'CONSULTA') return [];
  const gestor =
    usuario.perfil === 'ADMINISTRADOR' || usuario.perfil === 'GESTOR';
  if (item.status === 'DISPONIVEL')
    return gestor ? ['reservar', 'bloquear'] : ['reservar'];
  if (item.status === 'BLOQUEADO') return gestor ? ['desbloquear'] : [];
  if (item.status !== 'RESERVADO' || !item.vendedorId) return [];
  const acoes: AcaoMapa[] =
    gestor || item.vendedorId === usuario.id ? ['verReserva'] : [];
  if (gestor && item.propostaAprovada) acoes.push('vender');
  return acoes;
}
