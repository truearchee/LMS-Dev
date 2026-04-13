import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { requireAuth } from '../middleware/auth.js';

const BCRYPT_ROUNDS = 12;

// ─── Helpers ────────────────────────────────────────────────────────────────

function signAccess(server: FastifyInstance, payload: { userId: string; role: string }) {
  return (server as any).jwt.sign(payload, { expiresIn: env.JWT_EXPIRES_IN });
}

async function issueRefreshToken(
  server: FastifyInstance,
  userId: string,
): Promise<string> {
  const token = (server as any).jwt.sign({ userId }, { expiresIn: env.REFRESH_EXPIRES_IN });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // mirrors REFRESH_EXPIRES_IN default '7d'

  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function authRoutes(fastify: FastifyInstance) {

  // POST /api/v1/auth/register
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email, password } = request.body as {
      name: string;
      email: string;
      password: string;
    };

    if (!name || !email || !password) {
      return reply.status(400).send({ error: 'name, email, and password are required' });
    }
    if (password.length < 8) {
      return reply.status(400).send({ error: 'password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: 'email already registered' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { name, email, password: hash },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return reply.status(201).send({ user });
  });

  // POST /api/v1/auth/login
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });
    if (!user) {
      return reply.status(401).send({ error: 'invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.status(401).send({ error: 'invalid credentials' }); // same message — no enumeration
    }

    const accessToken  = signAccess(fastify, { userId: user.id, role: user.role });
    const refreshToken = await issueRefreshToken(fastify, user.id);

    return reply.send({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  // POST /api/v1/auth/refresh
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      return reply.status(400).send({ error: 'refreshToken is required' });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

    if (!stored || stored.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'invalid or expired refresh token' });
    }

    // One-time use — delete immediately
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const user = await prisma.user.findUnique({
      where: { id: stored.userId, deletedAt: null },
    });
    if (!user) {
      return reply.status(401).send({ error: 'user not found' });
    }

    const accessToken     = signAccess(fastify, { userId: user.id, role: user.role });
    const newRefreshToken = await issueRefreshToken(fastify, user.id);

    return reply.send({ accessToken, refreshToken: newRefreshToken });
  });

  // GET /api/v1/auth/me
  fastify.get('/me', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.user;
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) return reply.status(401).send({ error: 'user not found' });
    return reply.send(user);
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }

    return reply.send({ message: 'logged out' });
  });
}
