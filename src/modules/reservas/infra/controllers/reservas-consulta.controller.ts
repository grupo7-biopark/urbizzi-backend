import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import type { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { ListReservasQueryDto } from '../../application/dto/list-reservas-query.dto.js';
import { ReservaResumoDto } from '../../application/dto/reserva-resumo.dto.js';
import { ReservaConsultaService } from '../../application/services/reserva-consulta.service.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { VendedorReservaDto } from '../../application/dto/vendedor-reserva.dto.js';
@ApiTags('reservas')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL')
@Controller('reservas')
export class ReservasConsultaController {
  constructor(private readonly service: ReservaConsultaService) {}
  /** Lista os vendedores com reservas para seleção pelo nome, sem dados de contato */
  @Get('vendedores')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @Header('Cache-Control', 'no-store')
  @ApiPaginatedResponse(VendedorReservaDto)
  @ApiErrorResponses(400, 401, 403)
  vendedores(
    @Query() query: PaginationQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<VendedorReservaDto>> {
    return this.service.listVendedores(query, usuario);
  }
  /** Lista reservas com filtros combinados, por vencimento crescente; Comercial só vê as próprias */
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiPaginatedResponse(ReservaResumoDto)
  @ApiErrorResponses(400, 401, 403)
  list(
    @Query() query: ListReservasQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<ReservaResumoDto>> {
    return this.service.list(query, usuario);
  }
  /** Reservas do usuário autenticado, pelo vencimento mais próximo */
  @Get('minhas')
  @Header('Cache-Control', 'no-store')
  @ApiPaginatedResponse(ReservaResumoDto)
  @ApiErrorResponses(400, 401, 403)
  minhas(
    @Query() query: ListReservasQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<ReservaResumoDto>> {
    return this.service.list(query, usuario, true);
  }
}
