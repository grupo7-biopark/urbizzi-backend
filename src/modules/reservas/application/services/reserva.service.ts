import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Inject, Injectable } from '@nestjs/common';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import { PropriedadePolicy } from '../../../../shared/domain/policies/propriedade.policy.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { LoteService } from '../../../loteamentos/application/services/lote.service.js';
import { ClienteService } from '../../../clientes/application/services/cliente.service.js';
import { ConfiguracaoService } from '../../../configuracoes/application/services/configuracao.service.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Reserva } from '../../domain/models/reserva.entity.js';
import {
  RESERVA_REPOSITORY,
  type ReservaRepository,
} from '../../domain/repositories/reserva.repository.interface.js';
import type { CreateReservaDto } from '../dto/create-reserva.dto.js';
import { ReservaDto } from '../dto/reserva.dto.js';
@Injectable()
export class ReservaService {
  constructor(
    @Inject(RESERVA_REPOSITORY) private readonly repository: ReservaRepository,
    private readonly lotes: LoteService,
    private readonly clientes: ClienteService,
    private readonly configuracoes: ConfiguracaoService,
    private readonly auditoria: AuditoriaService,
    private readonly transactions: TransactionManager,
  ) {}
  async create(
    dto: CreateReservaDto,
    usuario: UsuarioAutenticado,
  ): Promise<ReservaDto> {
    this.assertPerfil(usuario);
    return this.transactions.run(async (tx) => {
      await this.clientes.validarExistencia(dto.clienteId, tx);
      await this.lotes.reservar(dto.loteId, usuario.id, tx);
      const reserva = Reserva.create(
        { ...dto, vendedorId: usuario.id },
        await this.configuracoes.getPrazoReservaDias(tx),
      );
      await this.repository.create(reserva, tx);
      const { id, loteId, status, dataInicio, dataVencimento } = reserva.dados;
      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: 'Reserva',
          entidadeId: id,
          acao: 'CRIAR',
          valorNovo: {
            loteId,
            status,
            dataInicio: dataInicio.toISOString(),
            dataVencimento: dataVencimento.toISOString(),
          },
        },
        tx,
      );
      return ReservaDto.from(reserva);
    });
  }
  async findById(
    id: string,
    usuario: UsuarioAutenticado,
    tx?: PrismaTransaction,
  ): Promise<ReservaDto> {
    this.assertPerfil(usuario);
    const reserva = await this.repository.findById(id, tx);
    if (!reserva)
      throw new NotFoundError(
        'RESERVA_NAO_ENCONTRADA',
        'Reserva não encontrada',
      );
    PropriedadePolicy.assertPodeAlterar(usuario, reserva.dados.vendedorId);
    return ReservaDto.from(reserva);
  }
  private assertPerfil(usuario: UsuarioAutenticado): void {
    if (usuario.perfil === 'CONSULTA')
      throw new ForbiddenError(
        'ACESSO_NEGADO',
        'Você não tem permissão para executar esta ação',
      );
  }
}
