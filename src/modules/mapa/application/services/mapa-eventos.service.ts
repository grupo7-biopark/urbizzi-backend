import {
  Injectable,
  Logger,
  type MessageEvent,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import {
  Subject,
  takeUntil,
  filter,
  interval,
  map,
  merge,
  type Observable,
} from 'rxjs';
import { z } from 'zod';
import type { Env } from '../../../../config/env.validation.js';

const eventoSchema = z.object({
  loteId: z.uuid(),
  loteamentoId: z.uuid(),
  status: z.enum(['DISPONIVEL', 'RESERVADO', 'VENDIDO', 'BLOQUEADO']),
});

@Injectable()
export class MapaEventosService implements OnModuleInit, OnModuleDestroy {
  private readonly eventos = new Subject<z.infer<typeof eventoSchema>>();
  private readonly fim = new Subject<void>();
  private readonly logger = new Logger(MapaEventosService.name);
  private client?: Client;
  private retry?: ReturnType<typeof setTimeout>;
  private encerrado = false;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    void this.conectar();
  }

  async onModuleDestroy(): Promise<void> {
    this.encerrado = true;
    clearTimeout(this.retry);
    this.fim.next();
    this.fim.complete();
    this.eventos.complete();
    await this.client?.end();
  }

  observar(loteamentoId?: string): Observable<MessageEvent> {
    return merge(
      this.eventos.pipe(
        filter(
          (evento) => !loteamentoId || evento.loteamentoId === loteamentoId,
        ),
        map(({ loteId, status }) => ({
          type: 'status-lote',
          data: { loteId, status },
        })),
      ),
      interval(15000).pipe(map(() => ({ type: 'heartbeat', data: {} }))),
    ).pipe(takeUntil(this.fim));
  }

  private async conectar(): Promise<void> {
    const client = new Client({
      connectionString: this.config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: 5000,
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
      if (channel !== 'status_lote' || !payload) return;
      try {
        const evento = eventoSchema.safeParse(JSON.parse(payload));
        if (evento.success) this.eventos.next(evento.data);
      } catch {
        this.logger.warn('Evento de status inválido');
      }
    });
    try {
      await client.connect();
      await client.query('LISTEN status_lote');
    } catch {
      reconectar();
    }
  }
}
