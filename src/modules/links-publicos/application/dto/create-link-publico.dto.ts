import { IsOptional, IsUUID } from 'class-validator';
export class CreateLinkPublicoDto {
  /** Opcional: limita o mapa a um loteamento; null mostra todos. @example null */
  @IsOptional()
  @IsUUID()
  loteamentoId?: string | null;
}
