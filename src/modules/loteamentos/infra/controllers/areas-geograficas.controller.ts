import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import {
  AreaGeograficaDto,
  AreaGeograficaDetalheDto,
  ListAreasGeograficasDto,
  SaveAreaGeograficaDto,
} from '../../application/dto/area-geografica.dto.js';
import { AreaGeograficaService } from '../../application/services/area-geografica.service.js';

@ApiTags('geografia')
@ApiBearerAuth()
@Controller('geografia/areas')
export class AreasGeograficasController {
  constructor(private readonly service: AreaGeograficaService) {}
  /** Lista contornos e status atuais dos cadastros ativos. */
  @Get()
  @ApiPaginatedResponse(AreaGeograficaDto)
  @ApiErrorResponses(400, 401)
  list(@Query() query: ListAreasGeograficasDto) {
    return this.service.list(query);
  }
  /** Consulta a demarcação; area=null indica cadastro ainda não demarcado. */
  @Get(':id')
  @ApiOkResponse({ type: AreaGeograficaDetalheDto })
  @ApiErrorResponses(400, 401)
  find(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }
  /** Substitui ou remove o limite de um loteamento. */
  @Put('loteamentos/:id')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiOkResponse({ type: AreaGeograficaDetalheDto })
  @ApiErrorResponses(400, 401, 403, 404, 422)
  saveLoteamento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAreaGeograficaDto,
    @CurrentUser() u: UsuarioAutenticado,
  ) {
    return this.service.save('LOTEAMENTO', id, dto, u.id);
  }
  /** Substitui ou remove o contorno de um lote, validando limite e sobreposição. */
  @Put('quadras/:id')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiOkResponse({ type: AreaGeograficaDetalheDto })
  @ApiErrorResponses(400, 401, 403, 404, 422)
  saveQuadra(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAreaGeograficaDto,
    @CurrentUser() u: UsuarioAutenticado,
  ) {
    return this.service.save('QUADRA', id, dto, u.id);
  }
  /** Substitui ou remove o contorno de um lote, validando limite e sobreposição. */
  @Put('lotes/:id')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiOkResponse({ type: AreaGeograficaDetalheDto })
  @ApiErrorResponses(400, 401, 403, 404, 422)
  saveLote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAreaGeograficaDto,
    @CurrentUser() u: UsuarioAutenticado,
  ) {
    return this.service.save('LOTE', id, dto, u.id);
  }
}
