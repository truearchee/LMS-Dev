import { config } from 'dotenv';
config(); // load .env into process.env before zod parses it

import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL:    z.string().min(1),
  JWT_SECRET:      z.string().min(32), // enforce minimum key length
  JWT_EXPIRES_IN:  z.string().default('15m'),
  REFRESH_EXPIRES_IN: z.string().default('7d'),
  NODE_ENV:        z.enum(['development', 'production', 'test']).default('development'),
  PORT:            z.string().default('3001'),

  // Storage — required in production, optional in dev (falls back to local)
  STORAGE_PROVIDER: z.enum(['local', 's3', 'r2']).default('local'),
  STORAGE_BUCKET:   z.string().optional(),
  STORAGE_REGION:   z.string().optional(),
  STORAGE_KEY_ID:   z.string().optional(),
  STORAGE_SECRET:   z.string().optional(),

  // AI — k2 is the primary provider for this project (K2 Think V2)
  AI_PROVIDER:  z.enum(['mock', 'openai', 'anthropic', 'k2']).default('mock'),
  AI_API_KEY:   z.string().optional(),
  AI_MODEL:     z.string().optional(),
  AI_BASE_URL:  z.string().url().optional(),
}).refine(
  (data) => data.AI_PROVIDER === 'mock' || !!data.AI_API_KEY,
  {
    message: 'AI_API_KEY is required when AI_PROVIDER is not mock',
    path: ['AI_API_KEY'],
  }
)

export const env = envSchema.parse(process.env)
