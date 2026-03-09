import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ApiLogInterceptor } from './common/dev-log/api-log.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useLogger(app.get(Logger));

  const config = new DocumentBuilder()
    .setTitle('Suggestions API')
    .setDescription('API для управления предложениями (suggestions)')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    jsonDocumentUrl: 'api-docs-json',
  });

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV');
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    app.useGlobalInterceptors(app.get(ApiLogInterceptor));
  }
  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);
}
bootstrap();
