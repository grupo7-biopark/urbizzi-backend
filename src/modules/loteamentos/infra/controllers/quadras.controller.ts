import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { CreateQuadraDto } from '../../application/dto/create-quadra.dto.js';
import { ListQuadrasQueryDto } from '../../application/dto/list-quadras-query.dto.js';
import { QuadraDto } from '../../application/dto/quadra.dto.js';
import { UpdateQuadraDto } from '../../application/dto/update-quadra.dto.js';
import { QuadraService } from '../../application/services/quadra.service.js';

@ApiTags('quadras')
@ApiBearerAuth()
@Controller()
export class QuadrasController {
  constructor(private readonly quadraService: QuadraService) {}

  /** Cria uma quadra no loteamento */
  @Post('loteamentos/:loteamentoId/quadras')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiErrorResponses(400, 401, 403, 404, 409)
  create(
    @Param('loteamentoId', ParseUUIDPipe) loteamentoId: string,
    @Body() dto: CreateQuadraDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<QuadraDto> {
    return this.quadraService.create(loteamentoId, dto, usuario);
  }

  /** Lista as quadras do loteamento com paginação e busca por número */
  @Get('loteamentos/:loteamentoId/quadras')
  @ApiPaginatedResponse(QuadraDto)
  @ApiErrorResponses(400, 401, 404)
  list(
    @Param('loteamentoId', ParseUUIDPipe) loteamentoId: string,
    @Query() query: ListQuadrasQueryDto,
  ): Promise<PaginatedDto<QuadraDto>> {
    return this.quadraService.list(loteamentoId, query);
  }

  /** Detalha uma quadra */
  @Get('quadras/:id')
  @ApiErrorResponses(400, 401, 404)
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<QuadraDto> {
    return this.quadraService.findById(id);
  }

  /** Altera o número de uma quadra */
  @Patch('quadras/:id')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiErrorResponses(400, 401, 403, 404, 409)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuadraDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<QuadraDto> {
    return this.quadraService.update(id, dto, usuario);
  }

  /** Exclui uma quadra sem lotes cadastrados */
  @Delete('quadras/:id')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.quadraService.delete(id, usuario);
  }
}
