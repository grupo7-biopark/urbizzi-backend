import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Cliente } from '../../domain/models/cliente.entity.js';
import {
  CLIENTE_REPOSITORY,
  type ClienteRepository,
} from '../../domain/repositories/cliente.repository.interface.js';
import type { CreateClienteDto } from '../dto/create-cliente.dto.js';
import type { UpdateClienteDto } from '../dto/update-cliente.dto.js';
import type { ListClientesQueryDto } from '../dto/list-clientes-query.dto.js';
import { ClienteDto, ClienteResumoDto } from '../dto/cliente.dto.js';
@Injectable()
export class ClienteService {
  constructor(
    @Inject(CLIENTE_REPOSITORY) private readonly repository: ClienteRepository,
    private readonly transactions: TransactionManager,
    private readonly auditoria: AuditoriaService,
  ) {}
  async create(dto: CreateClienteDto, usuarioId: string): Promise<ClienteDto> {
    const cliente = Cliente.create(dto);
    await this.ensureDocumento(cliente.documento);
    await this.transactions.run(async (tx) => {
      await this.repository.save(cliente, tx);
      await this.auditoria.registrar(
        {
          usuarioId,
          entidadeTipo: 'Cliente',
          entidadeId: cliente.id,
          acao: 'CRIAR',
          valorNovo: cliente.auditoria,
        },
        tx,
      );
    });
    return ClienteDto.from(cliente);
  }
  async validarExistencia(id: string, tx: PrismaTransaction): Promise<void> {
    if (!(await this.repository.findById(id, tx)))
      throw new NotFoundError(
        'CLIENTE_NAO_ENCONTRADO',
        'Cliente não encontrado',
      );
  }
  async findById(id: string): Promise<ClienteDto> {
    return ClienteDto.from(await this.getOrFail(id));
  }
  async list(
    query: ListClientesQueryDto,
  ): Promise<PaginatedDto<ClienteResumoDto>> {
    const result = await this.repository.list(query.q, query);
    return PaginatedDto.of(
      { items: result.items.map(ClienteResumoDto.from), total: result.total },
      query,
    );
  }
  async update(
    id: string,
    dto: UpdateClienteDto,
    usuarioId: string,
  ): Promise<ClienteDto> {
    const cliente = await this.getOrFail(id);
    const anterior = cliente.auditoria;
    cliente.atualizar(dto);
    await this.ensureDocumento(cliente.documento, id);
    await this.transactions.run(async (tx) => {
      await this.repository.save(cliente, tx);
      await this.auditoria.registrar(
        {
          usuarioId,
          entidadeTipo: 'Cliente',
          entidadeId: id,
          acao: 'ALTERAR',
          valorAnterior: anterior,
          valorNovo: {
            ...cliente.auditoria,
            camposAlterados: Object.entries(dto)
              .filter(([, value]) => value !== undefined)
              .map(([chave]) => chave),
          },
        },
        tx,
      );
    });
    return ClienteDto.from(cliente);
  }
  private async ensureDocumento(documento: string, id?: string) {
    if (await this.repository.existsByDocumento(documento, id))
      throw new ConflictError(
        'CLIENTE_DOCUMENTO_DUPLICADO',
        'Já existe um cliente com esse documento',
      );
  }
  private async getOrFail(id: string): Promise<Cliente> {
    const cliente = await this.repository.findById(id);
    if (!cliente)
      throw new NotFoundError(
        'CLIENTE_NAO_ENCONTRADO',
        'Cliente não encontrado',
      );
    return cliente;
  }
}
