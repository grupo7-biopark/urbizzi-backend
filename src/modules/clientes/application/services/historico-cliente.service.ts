import { Inject, Injectable } from '@nestjs/common';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { Pagination } from '../../../../shared/domain/pagination.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import {
  HISTORICO_CLIENTE_REPOSITORY,
  type HistoricoClienteRepository,
} from '../../domain/repositories/historico-cliente.repository.interface.js';
import { HistoricoClienteDto } from '../dto/historico-cliente.dto.js';
@Injectable()
export class HistoricoClienteService {
  constructor(
    @Inject(HISTORICO_CLIENTE_REPOSITORY)
    private readonly repository: HistoricoClienteRepository,
  ) {}
  async list(
    clienteId: string,
    query: Pagination,
    usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<HistoricoClienteDto>> {
    if (usuario.perfil === 'CONSULTA')
      throw new ForbiddenError(
        'ACESSO_NEGADO',
        'Você não tem permissão para executar esta ação',
      );
    const resultado = await this.repository.list(
      clienteId,
      query,
      usuario.perfil === 'COMERCIAL' ? usuario.id : undefined,
    );
    if (!resultado)
      throw new NotFoundError(
        'CLIENTE_NAO_ENCONTRADO',
        'Cliente não encontrado',
      );
    return PaginatedDto.of(
      {
        items: resultado.items.map(HistoricoClienteDto.from),
        total: resultado.total,
      },
      query,
    );
  }
}
