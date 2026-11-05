import { PropostasModule } from './modules/propostas/propostas.module.js';
import { ReservasModule } from './modules/reservas/reservas.module.js';
import { LinksPublicosModule } from './modules/links-publicos/links-publicos.module.js';
import { ClientesModule } from './modules/clientes/clientes.module.js';
import { ConfiguracoesModule } from './modules/configuracoes/configuracoes.module.js';
import { StorageModule } from './shared/infra/storage/storage.module.js';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PlantasModule } from './modules/plantas/plantas.module.js';
import { LoteamentosModule } from './modules/loteamentos/loteamentos.module.js';
import { MapaModule } from './modules/mapa/mapa.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation.js';
import { PrismaModule } from './shared/infra/database/prisma.module.js';
import { HealthModule } from './shared/infra/health/health.module.js';

@Module({
  imports: [
    PropostasModule,
    MapaModule,
    ReservasModule,
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate }),
    PrismaModule,
    HealthModule,
    StorageModule,
    AuditoriaModule,
    AuthModule,
    PlantasModule,
    LinksPublicosModule,
    ClientesModule,
    ConfiguracoesModule,
    LoteamentosModule,
    // Módulos de domínio (src/modules/<modulo>/<modulo>.module.ts) entram aqui.
  ],
})
export class AppModule {}
