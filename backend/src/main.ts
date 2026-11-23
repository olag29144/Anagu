import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const rawOrigins = process.env['CORS_ORIGIN']?.trim();
  const origin = rawOrigins
    ? rawOrigins
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : true;

  app.enableCors({
    origin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true,
  });

  const port = Number(process.env['PORT'] ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`Anagu backend running on port ${port}`);
}

void bootstrap();
