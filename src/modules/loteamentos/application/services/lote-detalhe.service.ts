import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import {
  LOTE_DETALHE_REPOSITORY,
  type LoteDetalheRepository,
} from '../../domain/repositories/lote-detalhe.repository.interface.js';
import type { LoteDetalheDto } from '../dto/lote-detalhe.dto.js';

@Injectable()
export class LoteDetalheService {
  constructor(
    @Inject(LOTE_DETALHE_REPOSITORY)
    private readonly repository: LoteDetalheRepository,
  ) {}

  async find(id: string, usuario: UsuarioAutenticado): Promise<LoteDetalheDto> {
    const detalhe = await this.repository.find(id, {
      podeVerReservas: usuario.perfil !== 'CONSULTA',
      podeVerAuditoriaDoLote:
        usuario.perfil === 'ADMINISTRADOR' || usuario.perfil === 'GESTOR',
      vendedorId: usuario.perfil === 'COMERCIAL' ? usuario.id : undefined,
    });
    if (!detalhe)
      throw new NotFoundError('LOTE_NAO_ENCONTRADO', 'Lote não encontrado');
    return detalhe;
  }
}
