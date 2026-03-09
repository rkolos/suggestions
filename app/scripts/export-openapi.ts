import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = new DocumentBuilder()
    .setTitle('Suggestions API')
    .setDescription('API для управления предложениями (suggestions)')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const outputPath = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');
  console.log(`OpenAPI spec written to ${outputPath}`);
  await app.close();
}

exportOpenApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
