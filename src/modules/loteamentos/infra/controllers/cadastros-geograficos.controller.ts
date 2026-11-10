import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import {
  CreateLoteamentoGeograficoDto,
  UpdateLoteamentoGeograficoDto,
  CreateLoteGeograficoDto,
  UpdateLoteGeograficoDto,
  CreateQuadraGeograficaDto,
  UpdateQuadraGeograficaDto,
} from '../../application/dto/cadastro-geografico.dto.js';
import { LoteDto } from '../../application/dto/lote.dto.js';
import { QuadraDto } from '../../application/dto/quadra.dto.js';
import { LoteamentoDto } from '../../application/dto/loteamento.dto.js';
import { CadastroGeograficoService } from '../../application/services/cadastro-geografico.service.js';

@ApiTags('geografia')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR')
@ApiErrorResponses(400, 401, 403, 404, 409, 422)
@Controller('geografia')
export class CadastrosGeograficosController {
  constructor(private readonly service: CadastroGeograficoService) {}
  /** Cria quadra e contorno dentro do loteamento atomicamente. */
  @Post('loteamentos/:loteamentoId/quadras')
  createQuadra(
    @Param('loteamentoId', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuadraGeograficaDto,
    @CurrentUser() u: UsuarioAutenticado,
  ): Promise<QuadraDto> {
    return this.service.createQuadra(id, dto, u);
  }
  /** Atualiza identificação e limite da quadra atomicamente. */
  @Patch('quadras/:id')
  updateQuadra(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuadraGeograficaDto,
    @CurrentUser() u: UsuarioAutenticado,
  ): Promise<QuadraDto> {
    return this.service.updateQuadra(id, dto, u);
  }
  /** Cria loteamento e demarcação atomicamente. */
  @Post('loteamentos')
  createLoteamento(
    @Body() dto: CreateLoteamentoGeograficoDto,
    @CurrentUser() u: UsuarioAutenticado,
  ): Promise<LoteamentoDto> {
    return this.service.createLoteamento(dto, u);
  }
  /** Atualiza loteamento e demarcação atomicamente. */
  @Patch('loteamentos/:id')
  updateLoteamento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoteamentoGeograficoDto,
    @CurrentUser() u: UsuarioAutenticado,
  ): Promise<LoteamentoDto> {
    return this.service.updateLoteamento(id, dto, u);
  }
  /** Cria lote e demarcação atomicamente. */
  @Post('lotes')
  createLote(
    @Body() dto: CreateLoteGeograficoDto,
    @CurrentUser() u: UsuarioAutenticado,
  ): Promise<LoteDto> {
    return this.service.createLote(dto, u);
  }
  /** Atualiza lote e demarcação atomicamente. */
  @Patch('lotes/:id')
  updateLote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoteGeograficoDto,
    @CurrentUser() u: UsuarioAutenticado,
  ): Promise<LoteDto> {
    return this.service.updateLote(id, dto, u);
  }
}
