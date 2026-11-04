import { IsUUID } from 'class-validator';
export class CreateReservaDto {
  /** Lote disponível a reservar. */ @IsUUID() loteId: string;
  /** Cliente previamente cadastrado. */ @IsUUID() clienteId: string;
}
