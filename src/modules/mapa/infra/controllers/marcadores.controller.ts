import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { MarcadorService } from '../../application/services/marcador.service.js';
import {
  CreateMarcadorDto,
  CoordenadasMarcadorDto,
} from '../../application/dto/create-marcador.dto.js';
import { CreateMarcadoresDto } from '../../application/dto/create-marcadores.dto.js';
import { MarcadorDto } from '../../application/dto/marcador.dto.js';
import {
  LoteSemMarcadorDto,
  LotesSemMarcadorQueryDto,
} from '../../application/dto/lotes-sem-marcador.dto.js';
@ApiTags('marcadores')
@ApiBearerAuth()
@Controller('plantas/:plantaId')
export class MarcadoresController {
  constructor(private readonly service: MarcadorService) {}
  /** Lista os marcadores da planta */
  @Get('marcadores')
  @ApiPaginatedResponse(MarcadorDto)
  @ApiErrorResponses(400, 401, 404)
  list(
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<MarcadorDto>> {
    return this.service.list(plantaId, query);
  }
  /** Lista lotes ainda não marcados nesta planta */
  @Get('lotes-sem-marcador')
  @ApiPaginatedResponse(LoteSemMarcadorDto)
  @ApiErrorResponses(400, 401, 404)
  semMarcador(
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Query() query: LotesSemMarcadorQueryDto,
  ): Promise<PaginatedDto<LoteSemMarcadorDto>> {
    return this.service.semMarcador(plantaId, query);
  }
  /** Posiciona um lote na planta */
  @Post('marcadores')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiCreatedResponse({ type: MarcadorDto })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  create(
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Body() dto: CreateMarcadorDto,
    @CurrentUser() ator: UsuarioAutenticado,
  ): Promise<MarcadorDto> {
    return this.service.create(plantaId, dto, ator.id);
  }
  /** Cria até 500 marcadores na mesma transação */
  @Post('marcadores/lote')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiCreatedResponse({ type: MarcadorDto, isArray: true })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  createMany(
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Body() dto: CreateMarcadoresDto,
    @CurrentUser() ator: UsuarioAutenticado,
  ): Promise<MarcadorDto[]> {
    return this.service.createMany(plantaId, dto.marcadores, ator.id);
  }
  /** Move um marcador sem alterar o lote associado */
  @Patch('marcadores/:id')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiOkResponse({ type: MarcadorDto })
  @ApiErrorResponses(400, 401, 403, 404)
  mover(
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CoordenadasMarcadorDto,
    @CurrentUser() ator: UsuarioAutenticado,
  ): Promise<MarcadorDto> {
    return this.service.mover(plantaId, id, dto, ator.id);
  }
  /** Confirma a revisão da posição nesta versão */
  @Post('marcadores/:id/revisar')
  @HttpCode(200)
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiOkResponse({ type: MarcadorDto })
  @ApiErrorResponses(400, 401, 403, 404)
  revisar(
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: UsuarioAutenticado,
  ): Promise<MarcadorDto> {
    return this.service.revisar(plantaId, id, ator.id);
  }
  /** Remove um marcador */
  @Delete('marcadores/:id')
  @HttpCode(204)
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiNoContentResponse()
  @ApiErrorResponses(400, 401, 403, 404)
  delete(
    @Param('plantaId', ParseUUIDPipe) plantaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: UsuarioAutenticado,
  ): Promise<void> {
    return this.service.delete(plantaId, id, ator.id);
  }
}
