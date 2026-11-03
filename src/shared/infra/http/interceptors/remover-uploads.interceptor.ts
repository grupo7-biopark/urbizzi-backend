import { rm } from 'node:fs/promises';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { finalize, type Observable } from 'rxjs';

interface ArquivoEmDisco {
  path?: string;
}

/**
 * Apaga os arquivos que o multer gravou em disco (`dest`) quando a requisição
 * termina, com sucesso ou erro, inclusive se a validação do DTO falhar.
 * Declare antes do FilesInterceptor: `@UseInterceptors(RemoverUploadsInterceptor, FilesInterceptor(...))`.
 */
@Injectable()
export class RemoverUploadsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      finalize(() => {
        void Promise.allSettled(
          arquivosDe(request).map((path) => rm(path, { force: true })),
        );
      }),
    );
  }
}

function arquivosDe(request: Request): string[] {
  const { file, files } = request as Request & {
    file?: ArquivoEmDisco;
    files?: ArquivoEmDisco[] | Record<string, ArquivoEmDisco[]>;
  };
  const lista = [
    ...(file ? [file] : []),
    ...(Array.isArray(files) ? files : Object.values(files ?? {}).flat()),
  ];
  return lista.flatMap((arquivo) => (arquivo.path ? [arquivo.path] : []));
}
