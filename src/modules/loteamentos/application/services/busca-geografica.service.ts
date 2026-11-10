import { Inject, Injectable } from '@nestjs/common';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import {
  GEOCODIFICADOR,
  type Geocodificador,
} from '../../domain/repositories/geocodificador.interface.js';
import type { BuscaGeograficaDto } from '../dto/busca-geografica.dto.js';
@Injectable()
export class BuscaGeograficaService {
  constructor(
    @Inject(GEOCODIFICADOR) private readonly provider: Geocodificador,
  ) {}
  async search(query: BuscaGeograficaDto) {
    const items = await this.provider.search(query.q);
    const offset = (query.page - 1) * query.pageSize;
    return PaginatedDto.of(
      {
        items: items.slice(offset, offset + query.pageSize),
        total: items.length,
      },
      query,
    );
  }
}
