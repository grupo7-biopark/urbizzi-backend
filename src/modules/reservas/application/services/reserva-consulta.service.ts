import { Inject, Injectable } from '@nestjs/common';
import {
  ForbiddenError,
  InvalidInputError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import {
  RESERVA_CONSULTA_REPOSITORY,
  type ReservaConsultaRepository,
} from '../../domain/repositories/reserva-consulta.repository.interface.js';
import type { ListReservasQueryDto } from '../dto/list-reservas-query.dto.js';
import type { ReservaResumoDto } from '../dto/reserva-resumo.dto.js';
@Injectable()
export class ReservaConsultaService {
  constructor(
    @Inject(RESERVA_CONSULTA_REPOSITORY)
    private readonly repository: ReservaConsultaRepository,
  ) {}
  async list(
    query: ListReservasQueryDto,
    usuario: UsuarioAutenticado,
    minhas = false,
  ): Promise<PaginatedDto<ReservaResumoDto>> {
    if (usuario.perfil === 'CONSULTA')
      throw new ForbiddenError(
        'ACESSO_NEGADO',
        'Você não tem permissão para executar esta ação',
      );
    if (
      query.vencimentoDe &&
      query.vencimentoAte &&
      new Date(query.vencimentoDe) > new Date(query.vencimentoAte)
    )
      throw new InvalidInputError(
        'PERIODO_INVALIDO',
        'O início do período deve ser anterior ou igual ao fim',
      );
    const filtros = {
      ...query,
      vendedorId:
        minhas || usuario.perfil === 'COMERCIAL'
          ? usuario.id
          : query.vendedorId,
    };
    return PaginatedDto.of(await this.repository.list(filtros), query);
  }
}
