import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { LoteamentosModule } from '../loteamentos/loteamentos.module.js';
import { LinkPublicoService } from './application/services/link-publico.service.js';
import { LINK_PUBLICO_REPOSITORY } from './domain/repositories/link-publico.repository.interface.js';
import { PrismaLinkPublicoRepository } from './infra/repositories/prisma-link-publico.repository.js';
import { LinksPublicosController } from './infra/controllers/links-publicos.controller.js';
@Module({
  imports: [AuditoriaModule, LoteamentosModule],
  providers: [
    LinkPublicoService,
    { provide: LINK_PUBLICO_REPOSITORY, useClass: PrismaLinkPublicoRepository },
  ],
  controllers: [LinksPublicosController],
  exports: [LinkPublicoService],
})
export class LinksPublicosModule {}
