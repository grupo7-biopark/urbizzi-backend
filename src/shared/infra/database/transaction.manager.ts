import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import type { PrismaTransaction } from './prisma.transaction.js';

/**
 * Abre transações interativas do Prisma para os services da camada
 * application, sem que eles dependam do PrismaService diretamente.
 *
 * Nos testes unitários, substitua por `{ run: (fn) => fn({}) }`.
 */
@Injectable()
export class TransactionManager {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
