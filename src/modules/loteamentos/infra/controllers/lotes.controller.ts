import { BloquearLoteDto } from '../../application/dto/bloquear-lote.dto.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { CreateLoteDto } from '../../application/dto/create-lote.dto.js';
import { ListLotesQueryDto } from '../../application/dto/list-lotes-query.dto.js';
import { LoteDto } from '../../application/dto/lote.dto.js';
import { UpdateLoteDto } from '../../application/dto/update-lote.dto.js';
import { LoteDetalheDto } from '../../application/dto/lote-detalhe.dto.js';
import { LoteDetalheService } from '../../application/services/lote-detalhe.service.js';
import { LoteService } from '../../application/services/lote.service.js';

@ApiTags('lotes')
@ApiBearerAuth()
@Controller('lotes')
export class LotesController {
  constructor(
    private readonly loteService: LoteService,
    private readonly loteDetalheService: LoteDetalheService,
  ) {}

  /** Cria um lote DISPONIVEL na quadra */
  @Post()
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiErrorResponses(400, 401, 403, 404, 409)
  create(
    @Body() dto: CreateLoteDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<LoteDto> {
    return this.loteService.create(dto, usuario);
  }

  /** Lista lotes com paginação e filtros por loteamento, quadra, status e número */
  @Get()
  @ApiPaginatedResponse(LoteDto)
  @ApiErrorResponses(400, 401)
  list(@Query() query: ListLotesQueryDto): Promise<PaginatedDto<LoteDto>> {
    return this.loteService.list(query);
  }

  /** Detalha um lote */
  @Get(':id')
  @ApiErrorResponses(400, 401, 404)
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<LoteDto> {
    return this.loteService.findById(id);
  }

  /** Consulta o lote com reserva, propostas e histórico conforme o perfil */
  @Get(':id/detalhe')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LoteDetalheDto })
  @ApiErrorResponses(400, 401, 404)
  detalhe(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<LoteDetalheDto> {
    return this.loteDetalheService.find(id, usuario);
  }

  /** Atualiza parcialmente o cadastro de um lote (o status não muda por aqui) */
  @Patch(':id')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiErrorResponses(400, 401, 403, 404, 409)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoteDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<LoteDto> {
    return this.loteService.update(id, dto, usuario);
  }

  /** Exclui um lote DISPONIVEL que nunca foi reservado */
  @Delete(':id')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.loteService.delete(id, usuario);
  }
  /** Bloqueia um lote disponível por decisão administrativa */
  @Post(':id/bloquear')
  @HttpCode(200)
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiErrorResponses(400, 401, 403, 404, 409, 422)
  bloquear(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BloquearLoteDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<LoteDto> {
    return this.loteService.bloquear(id, dto, usuario);
  }

  /** Devolve um lote bloqueado à disponibilidade */
  @Post(':id/desbloquear')
  @HttpCode(200)
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiErrorResponses(400, 401, 403, 404, 409)
  desbloquear(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<LoteDto> {
    return this.loteService.desbloquear(id, usuario);
  }
}
