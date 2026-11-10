import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import {
  BuscaGeograficaDto,
  LugarGeograficoDto,
} from '../../application/dto/busca-geografica.dto.js';
import { BuscaGeograficaService } from '../../application/services/busca-geografica.service.js';
@ApiTags('geografia')
@ApiBearerAuth()
@Controller('geografia/busca')
export class BuscasGeograficasController {
  constructor(private readonly service: BuscaGeograficaService) {}
  /** Busca manual de local, com cache e limite global de 1 consulta/s ao provedor. */
  @Get()
  @ApiPaginatedResponse(LugarGeograficoDto)
  @ApiErrorResponses(400, 401, 422)
  search(@Query() query: BuscaGeograficaDto) {
    return this.service.search(query);
  }
}
