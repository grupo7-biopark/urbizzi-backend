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
import { CreateLoteamentoDto } from '../../application/dto/create-loteamento.dto.js';
import { ListLoteamentosQueryDto } from '../../application/dto/list-loteamentos-query.dto.js';
import { LoteamentoDto } from '../../application/dto/loteamento.dto.js';
import { UpdateLoteamentoDto } from '../../application/dto/update-loteamento.dto.js';
import { LoteamentoService } from '../../application/services/loteamento.service.js';

@ApiTags('loteamentos')
@ApiBearerAuth()
@Controller('loteamentos')
export class LoteamentosController {
  constructor(private readonly loteamentoService: LoteamentoService) {}

  /** Cria um loteamento */
  @Post()
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiErrorResponses(400, 401, 403, 409)
  create(
    @Body() dto: CreateLoteamentoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<LoteamentoDto> {
    return this.loteamentoService.create(dto, usuario);
  }

  /** Lista loteamentos com paginação e busca por nome */
  @Get()
  @ApiPaginatedResponse(LoteamentoDto)
  @ApiErrorResponses(400, 401)
  list(
    @Query() query: ListLoteamentosQueryDto,
  ): Promise<PaginatedDto<LoteamentoDto>> {
    return this.loteamentoService.list(query);
  }

  /** Detalha um loteamento */
  @Get(':id')
  @ApiErrorResponses(400, 401, 404)
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<LoteamentoDto> {
    return this.loteamentoService.findById(id);
  }

  /** Atualiza parcialmente um loteamento */
  @Patch(':id')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiErrorResponses(400, 401, 403, 404, 409)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoteamentoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<LoteamentoDto> {
    return this.loteamentoService.update(id, dto, usuario);
  }

  /** Exclui um loteamento sem quadras cadastradas */
  @Delete(':id')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.loteamentoService.delete(id, usuario);
  }
}
