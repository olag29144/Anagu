import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

let app: any;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, { 
      logger: ['error', 'warn'],
      abortOnError: false 
    });
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
    await app.init();
  }
  return app;
}

export default async function handler(req: any, res: any) {
  try {
    const server = await bootstrap();
    const expressApp = server.getHttpAdapter().getInstance();
    return expressApp(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
