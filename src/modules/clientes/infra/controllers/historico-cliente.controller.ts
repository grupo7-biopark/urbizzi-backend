import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { HistoricoClienteService } from '../../application/services/historico-cliente.service.js';
import { HistoricoClienteDto } from '../../application/dto/historico-cliente.dto.js';
@ApiTags('clientes')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL')
@Controller('clientes/:id/historico')
export class HistoricoClienteController {
  constructor(private readonly service: HistoricoClienteService) {}
  /** Histórico paginado de reservas e propostas do cliente, do mais recente */
  @Get()
  @ApiOperation({
    summary: 'Consultar histórico de reservas e propostas do cliente',
    description:
      'Linha do tempo paginada por início da reserva ou envio da proposta, do mais recente. Administrador e Gestor veem todos os registros; Comercial vê suas reservas e as propostas delas. Consulta não tem acesso.',
  })
  @Header('Cache-Control', 'no-store')
  @ApiPaginatedResponse(HistoricoClienteDto)
  @ApiErrorResponses(400, 401, 403, 404)
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<HistoricoClienteDto>> {
    return this.service.list(id, query, usuario);
  }
}
