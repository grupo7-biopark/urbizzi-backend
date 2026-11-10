import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { Subject } from 'rxjs';
import { z } from 'zod';
import type { Env } from '../../../../config/env.validation.js';
import type {
  MapaEventosFonte,
  EventoFonteMapa,
} from '../../domain/repositories/mapa-eventos-fonte.interface.js';
const eventoSchema = z.object({
  loteId: z.uuid(),
  loteamentoId: z.uuid(),
  status: z.enum(['DISPONIVEL', 'RESERVADO', 'VENDIDO', 'BLOQUEADO']),
});
/** Adapter de infraestrutura: LISTEN é dedicado e NOTIFY só é entregue após commit. */
@Injectable()
export class PgMapaEventosFonte
  implements MapaEventosFonte, OnModuleInit, OnModuleDestroy
{
  private readonly eventos = new Subject<EventoFonteMapa>();
  readonly eventos$ = this.eventos.asObservable();
  private readonly logger = new Logger(PgMapaEventosFonte.name);
  private client?: Client;
  private retry?: ReturnType<typeof setTimeout>;
  private encerrado = false;
  constructor(private readonly config: ConfigService<Env, true>) {}
  onModuleInit() {
    return this.conectar();
  }
  async onModuleDestroy() {
    this.encerrado = true;
    clearTimeout(this.retry);
    this.eventos.complete();
    await this.client?.end();
  }
  private async conectar(): Promise<void> {
    if (this.encerrado) return;
    const client = new Client({
      connectionString: this.config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: 5000,
      application_name: 'urbizzi-mapa-eventos',
    });
    this.client = client;
    const reconectar = () => {
      if (this.encerrado || this.client !== client) return;
      this.client = undefined;
      void client.end().catch(() => undefined);
      this.logger.warn('Conexão de eventos do mapa indisponível; reconectando');
      this.retry = setTimeout(() => void this.conectar(), 3000);
    };
    client.on('error', reconectar);
    client.on('end', reconectar);
    client.on('notification', ({ channel, payload }) => {
      if (
        this.encerrado ||
        this.client !== client ||
        channel !== 'status_lote' ||
        !payload
      )
        return;
      try {
        const evento = eventoSchema.safeParse(JSON.parse(payload));
        if (evento.success)
          this.eventos.next({ tipo: 'status', ...evento.data });
      } catch {
        this.logger.warn('Evento de status inválido');
      }
    });
    try {
      await client.connect();
      await client.query('LISTEN status_lote');
      if (!this.encerrado && this.client === client)
        this.eventos.next({ tipo: 'ressincronizar' });
    } catch {
      reconectar();
    }
  }
}
