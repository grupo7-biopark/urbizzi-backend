import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type {
  CreateLoteamentoGeograficoDto,
  UpdateLoteamentoGeograficoDto,
  CreateLoteGeograficoDto,
  UpdateLoteGeograficoDto,
  CreateQuadraGeograficaDto,
  UpdateQuadraGeograficaDto,
} from '../dto/cadastro-geografico.dto.js';
import { LoteamentoService } from './loteamento.service.js';
import { LoteService } from './lote.service.js';
import { AreaGeograficaService } from './area-geografica.service.js';
import { QuadraService } from './quadra.service.js';

/** Cadastro e contorno são confirmados juntos; qualquer erro desfaz ambos. */
@Injectable()
export class CadastroGeograficoService {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly loteamentos: LoteamentoService,
    private readonly lotes: LoteService,
    private readonly areas: AreaGeograficaService,
    private readonly quadras: QuadraService,
  ) {}
  createQuadra(
    loteamentoId: string,
    dto: CreateQuadraGeograficaDto,
    u: UsuarioAutenticado,
  ) {
    return this.transactions.run(async (tx) => {
      await this.areas.bloquear('LOTEAMENTO', loteamentoId, tx);
      const cadastro = await this.quadras.create(
        loteamentoId,
        dto.cadastro,
        u,
        tx,
      );
      await this.areas.save('QUADRA', cadastro.id, dto, u.id, tx);
      return cadastro;
    });
  }
  updateQuadra(
    id: string,
    dto: UpdateQuadraGeograficaDto,
    u: UsuarioAutenticado,
  ) {
    return this.transactions.run(async (tx) => {
      await this.areas.bloquear('QUADRA', id, tx);
      const cadastro = await this.quadras.update(id, dto.cadastro, u, tx);
      await this.areas.save('QUADRA', id, dto, u.id, tx);
      return cadastro;
    });
  }
  createLoteamento(dto: CreateLoteamentoGeograficoDto, u: UsuarioAutenticado) {
    return this.transactions.run(async (tx) => {
      const cadastro = await this.loteamentos.create(dto.cadastro, u, tx);
      await this.areas.save('LOTEAMENTO', cadastro.id, dto, u.id, tx);
      return cadastro;
    });
  }
  updateLoteamento(
    id: string,
    dto: UpdateLoteamentoGeograficoDto,
    u: UsuarioAutenticado,
  ) {
    return this.transactions.run(async (tx) => {
      await this.areas.bloquear('LOTEAMENTO', id, tx);
      const cadastro = await this.loteamentos.update(id, dto.cadastro, u, tx);
      await this.areas.save('LOTEAMENTO', id, dto, u.id, tx);
      return cadastro;
    });
  }
  createLote(dto: CreateLoteGeograficoDto, u: UsuarioAutenticado) {
    return this.transactions.run(async (tx) => {
      await this.areas.bloquear('QUADRA', dto.cadastro.quadraId, tx);
      const cadastro = await this.lotes.create(dto.cadastro, u, tx);
      await this.areas.save('LOTE', cadastro.id, dto, u.id, tx);
      return cadastro;
    });
  }
  updateLote(id: string, dto: UpdateLoteGeograficoDto, u: UsuarioAutenticado) {
    return this.transactions.run(async (tx) => {
      await this.areas.bloquear('LOTE', id, tx);
      const cadastro = await this.lotes.update(id, dto.cadastro, u, tx);
      await this.areas.save('LOTE', id, dto, u.id, tx);
      return cadastro;
    });
  }
}
