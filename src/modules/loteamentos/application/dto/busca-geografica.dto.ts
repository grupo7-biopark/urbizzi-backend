import { IsString, Length } from 'class-validator';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
export class BuscaGeograficaDto extends PaginationQueryDto {
  /** Endereço ou local. A busca acontece somente ao pressionar Pesquisar. */
  @IsString()
  @Trim()
  @Length(3, 200)
  q: string;
}
export class LugarGeograficoDto {
  nome: string;
  latitude: number;
  longitude: number;
}
