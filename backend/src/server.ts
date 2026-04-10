import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import jwt from '@fastify/jwt';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './lib/env.js';
import { prisma } from './lib/prisma.js';
import { authRoutes }       from './routes/auth.js';
import { coursesRoutes }    from './routes/courses.js';
import { makeLectureRoutes } from './routes/lectures.js';
import { transcriptRoutes } from './routes/transcripts.js';
import { makeAiRoutes }     from './routes/ai.js';
import { uploadRoutes }     from './routes/upload.js';
import { LocalStorageService, StorageService } from './services/storage/StorageService.js';
import { AIProvider, MockAIProvider, OpenAIProvider, AnthropicProvider } from './services/ai/AIService.js';
import { JobWorker } from './services/ai/JobWorker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = Fastify({ logger: true });

// ─── Storage ─────────────────────────────────────────────────────────────────
const storage: StorageService = new LocalStorageService(); // swap via STORAGE_PROVIDER env

// ─── AI Provider ──────────────────────────────────────────────────────────────
const ai: AIProvider = env.AI_API_KEY
  ? env.AI_PROVIDER === 'anthropic'
    ? new AnthropicProvider(env.AI_API_KEY)
    : new OpenAIProvider(env.AI_API_KEY)
  : new MockAIProvider();

// ─── Plugins ─────────────────────────────────────────────────────────────────
await server.register(cors, {
  origin:      env.NODE_ENV === 'production' ? ['https://yourdomain.com'] : ['http://localhost:3000'],
  credentials: true,
});

await server.register(jwt, { secret: env.JWT_SECRET });

await server.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } });

await server.register(staticPlugin, {
  root:   path.join(process.cwd(), 'uploads'),
  prefix: '/uploads/',
});

// ─── Routes ──────────────────────────────────────────────────────────────────
server.register(authRoutes,                                  { prefix: '/api/v1/auth' });
server.register(coursesRoutes,                               { prefix: '/api/v1/courses' });
server.register(async (f) => makeLectureRoutes(storage)(f),  { prefix: '/api/v1/lectures' });
server.register(transcriptRoutes,                            { prefix: '/api/v1/transcripts' });
server.register(makeAiRoutes(ai),                            { prefix: '/api/v1/ai' });
server.register(async (f) => uploadRoutes(f, { storage }),   { prefix: '/api/upload' });

// ─── Boot ─────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await server.listen({ port: Number(env.PORT), host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${env.PORT}`);

    const worker = new JobWorker(prisma, ai);
    worker.start();

    const shutdown = async () => {
      worker.stop();
      await server.close();
      await prisma.$disconnect();
      process.exit(0);
    };
    process.on('SIGINT',  shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
