import { FastifyRequest, FastifyReply } from 'fastify';

// Tell @fastify/jwt what shape our token payload has.
// This augments the UserType that jwt already declares on FastifyRequest.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; role: string };
    user:    { userId: string; role: string };
  }
}

// ─── requireAuth ────────────────────────────────────────────────────────────
// 1. Extracts Bearer token from Authorization header
// 2. Verifies JWT signature with JWT_SECRET (via @fastify/jwt)
// 3. Attaches decoded payload to request.user
// 4. Returns 401 if missing or invalid
export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // jwtVerify reads the Bearer header, verifies signature, and populates request.user
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'missing or invalid token' });
  }
};

// ─── requireRole ────────────────────────────────────────────────────────────
// 1. Assumes requireAuth already ran and request.user is populated
// 2. Checks request.user.role is in the allowed roles array
// 3. Returns 403 if not authorized
export const requireRole =
  (...roles: string[]) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'unauthenticated' });
    }
    if (!roles.includes(request.user.role)) {
      return reply
        .status(403)
        .send({ error: `forbidden — required role: ${roles.join(' or ')}` });
    }
  };
