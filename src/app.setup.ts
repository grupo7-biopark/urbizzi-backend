import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ErrorResponseDto } from './shared/infra/http/dto/error-response.dto.js';
import { AllExceptionsFilter } from './shared/infra/http/filters/all-exceptions.filter.js';
import { validationExceptionFactory } from './shared/infra/http/validation-exception.factory.js';

export function setupApp(app: INestApplication): void {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Urbizzi API')
    .setDescription('API do backend do Urbizzi')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      extraModels: [ErrorResponseDto],
    });
  SwaggerModule.setup('docs', app, documentFactory);
}
