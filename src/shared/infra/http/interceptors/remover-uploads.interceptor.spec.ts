import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { RemoverUploadsInterceptor } from './remover-uploads.interceptor.js';

describe('RemoverUploadsInterceptor', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'uploads-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function arquivo(nome: string) {
    const path = join(dir, nome);
    await writeFile(path, 'x');
    return { path };
  }

  function contexto(request: object) {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  async function aguardarRemocao(...paths: string[]) {
    await vi.waitFor(() => {
      for (const path of paths) expect(existsSync(path)).toBe(false);
    });
  }

  it('remove arquivos de files (lista) e file após sucesso', async () => {
    const a = await arquivo('a');
    const b = await arquivo('b');
    const next: CallHandler = { handle: () => of('ok') };
    const result = new RemoverUploadsInterceptor().intercept(
      contexto({ files: [a], file: b }),
      next,
    );
    await expect(firstValueFrom(result)).resolves.toBe('ok');
    await aguardarRemocao(a.path, b.path);
  });

  it('remove arquivos de files por campo também em caso de erro', async () => {
    const a = await arquivo('a');
    const next: CallHandler = {
      handle: () => throwError(() => new Error('falhou')),
    };
    const result = new RemoverUploadsInterceptor().intercept(
      contexto({ files: { arquivos: [a, {}] } }),
      next,
    );
    await expect(firstValueFrom(result)).rejects.toThrow('falhou');
    await aguardarRemocao(a.path);
  });

  it('não falha sem arquivos', async () => {
    const next: CallHandler = { handle: () => of(1) };
    const result = new RemoverUploadsInterceptor().intercept(
      contexto({}),
      next,
    );
    await expect(firstValueFrom(result)).resolves.toBe(1);
  });
});
