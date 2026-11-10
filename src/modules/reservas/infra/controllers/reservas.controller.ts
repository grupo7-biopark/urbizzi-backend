import {
  Body,
  Controller,
  Get,
  HttpCode,
  Query,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { CreateReservaDto } from '../../application/dto/create-reserva.dto.js';
import { PrevisaoReservaDto } from '../../application/dto/previsao-reserva.dto.js';
import { ReservaDto } from '../../application/dto/reserva.dto.js';
import { ReservaService } from '../../application/services/reserva.service.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { CancelarReservaDto } from '../../application/dto/cancelar-reserva.dto.js';
import { RenovacaoDto } from '../../domain/models/renovacao.js';
@ApiTags('reservas')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL')
@Controller('reservas')
export class ReservasController {
  constructor(private readonly service: ReservaService) {}
  /** Reserva lote disponível para o cliente; vendedor é o usuário autenticado */
  @Post()
  @ApiCreatedResponse({ type: ReservaDto })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422)
  create(
    @Body() dto: CreateReservaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ReservaDto> {
    return this.service.create(dto, usuario);
  }
  /** Estende o vencimento de uma reserva ativa. */
  @Post(':id/renovar')
  @HttpCode(200)
  @ApiOkResponse({ type: ReservaDto })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422)
  renovar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.service.renovar(id, usuario);
  }

  /** Cancela a reserva e libera o lote. */
  @Post(':id/cancelar')
  @HttpCode(200)
  @ApiOkResponse({ type: ReservaDto })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelarReservaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.service.cancelar(id, dto, usuario);
  }

  /** Histórico paginado das renovações. */
  @Get(':id/renovacoes')
  @ApiPaginatedResponse(RenovacaoDto)
  @ApiErrorResponses(400, 401, 403, 404)
  listarRenovacoes(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.service.listarRenovacoes(id, query, usuario);
  }

  /** Prevê o vencimento de uma reserva iniciada agora, sem criar a reserva. */
  @Get('previsao')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PrevisaoReservaDto })
  @ApiErrorResponses(401, 403, 422)
  prever(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PrevisaoReservaDto> {
    return this.service.preverVencimento(usuario);
  }
  /** Consulta a reserva com tempo restante; Comercial só consulta as próprias */
  @Get(':id')
  @ApiOkResponse({ type: ReservaDto })
  @ApiErrorResponses(400, 401, 403, 404)
  find(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ReservaDto> {
    return this.service.findById(id, usuario);
  }
}
