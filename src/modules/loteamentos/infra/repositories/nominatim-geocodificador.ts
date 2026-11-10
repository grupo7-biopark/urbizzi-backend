import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../config/env.validation.js';
import { BusinessRuleError } from '../../../../shared/domain/errors/domain.error.js';
import type {
  Geocodificador,
  Lugar,
} from '../../domain/repositories/geocodificador.interface.js';

/** Uma fila e cache por instância. Destinado somente ao teste local, com uma API. */
@Injectable()
export class NominatimGeocodificador implements Geocodificador {
  private queue: Promise<unknown> = Promise.resolve();
  private nextRequest = 0;
  private cache = new Map<string, { at: number; items: Lugar[] }>();
  constructor(private readonly config: ConfigService<Env, true>) {}
  search(query: string): Promise<Lugar[]> {
    const key = query.trim().toLocaleLowerCase('pt-BR');
    const task = this.queue.then(async () => {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.at < 86400000) return cached.items;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, this.nextRequest - Date.now())),
      );
      this.nextRequest = Date.now() + 1100;
      try {
        const url = new URL(
          this.config.get('GEOCODIFICADOR_URL', { infer: true }),
        );
        url.search = new URLSearchParams({
          q: query,
          format: 'jsonv2',
          limit: '5',
          'accept-language': 'pt-BR',
        }).toString();
        const response = await fetch(url, {
          headers: {
            'User-Agent':
              'Urbizzi-local/1.0 (+https://github.com/grupo7-biopark/urbizzi-backend)',
          },
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) throw new Error('provider');
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('format');
        const items: Lugar[] = data.slice(0, 5).flatMap((row: unknown) => {
          if (
            !row ||
            typeof row !== 'object' ||
            !('display_name' in row) ||
            !('lat' in row) ||
            !('lon' in row)
          )
            return [];
          if (
            typeof row.lat !== 'string' ||
            !row.lat.trim() ||
            typeof row.lon !== 'string' ||
            !row.lon.trim()
          )
            return [];
          const latitude = Number(row.lat),
            longitude = Number(row.lon);
          return typeof row.display_name === 'string' &&
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            Math.abs(latitude) <= 85 &&
            Math.abs(longitude) <= 180
            ? [{ nome: row.display_name.slice(0, 500), latitude, longitude }]
            : [];
        });
        if (this.cache.size >= 200)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { at: Date.now(), items });
        return items;
      } catch {
        throw new BusinessRuleError(
          'BUSCA_GEOGRAFICA_INDISPONIVEL',
          'A busca está indisponível. Tente novamente ou localize pelas coordenadas.',
        );
      }
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}
