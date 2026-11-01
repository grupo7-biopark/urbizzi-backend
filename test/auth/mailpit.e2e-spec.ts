import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { Argon2PasswordHasher } from '../../src/shared/infra/auth/argon2-password-hasher.js';
import { limparBanco } from '../helpers/database.js';
describe.skipIf(process.env.MAILPIT_E2E !== 'true')(
  'SMTP real com Mailpit (e2e)',
  () => {
    let app: INestApplication;
    const api = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';
    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      setupApp(app);
      await app.init();
    });
    afterAll(async () => {
      await app?.close();
    });
    it('entrega e-mail visível no Mailpit e redefine usando o token recebido', async () => {
      const prisma = app.get(PrismaService);
      await limparBanco(prisma);
      await fetch(`${api}/api/v1/messages`, { method: 'DELETE' });
      const perfil = await prisma.perfil.create({
        data: { codigo: 'COMERCIAL', nome: 'Comercial' },
      });
      const email = 'mailpit@exemplo.com';
      await prisma.usuario.create({
        data: {
          nome: 'Teste Mailpit',
          email,
          senhaHash: await new Argon2PasswordHasher().hash('SenhaAntiga123!'),
          perfilId: perfil.id,
        },
      });
      await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email })
        .expect(202);
      const response = await fetch(`${api}/api/v1/messages`);
      expect(response.ok).toBe(true);
      const list = (await response.json()) as {
        messages: { ID: string; To: { Address: string }[] }[];
      };
      expect(list.messages).toHaveLength(1);
      expect(list.messages[0].To[0].Address).toBe(email);
      const message = (await (
        await fetch(`${api}/api/v1/message/${list.messages[0].ID}`)
      ).json()) as { Text: string };
      const token = message.Text.match(/[?&]token=([A-Za-z0-9_-]{43})/)?.[1];
      expect(token).toBeDefined();
      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ token, senha: 'NovaSenha123!' })
        .expect(204);
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, senha: 'NovaSenha123!' })
        .expect(200);
    });
  },
);
