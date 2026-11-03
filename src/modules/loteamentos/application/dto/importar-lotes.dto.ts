import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

// Campos de multipart/form-data chegam como texto
const booleano = Transform(({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value,
);

export class ImportarLotesDto {
  /**
   * `false` (padrão) só valida e devolve a prévia; `true` grava, se não houver erros
   * @example false
   */
  @booleano
  @IsOptional()
  @IsBoolean()
  confirmar?: boolean;

  /**
   * Cria loteamentos e quadras que ainda não existem (padrão `false`)
   * @example false
   */
  @booleano
  @IsOptional()
  @IsBoolean()
  criarCadastros?: boolean;
}
