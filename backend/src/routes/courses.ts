import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const coursesRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/courses - TEACHER, ADMIN
  server.get('/', { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] }, async (request, reply) => {
    const courses = await prisma.course.findMany({
      where: { deletedAt: null },
      include: { teacher: { select: { name: true, email: true } } }
    });
    return reply.send({ courses });
  });

  // POST /api/v1/courses - TEACHER, ADMIN
  server.post('/', { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] }, async (request, reply) => {
    const { title, description } = request.body as { title: string, description?: string };
    
    if (!title) return reply.status(400).send({ error: 'Title is required' });
    if (!request.user || !request.user.userId) return reply.status(401).send();

    const course = await prisma.course.create({
      data: {
        title,
        description,
        teacherId: request.user.userId
      }
    });

    return reply.status(201).send({ course });
  });

  // GET /api/v1/courses/:id - Enrolled users
  server.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    if (!request.user) return reply.status(401).send();
    
    const { userId, role } = request.user;
    
    // Access check: Admin and Teacher can bypass enrollment constraint
    if (role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: id } }
      });
      if (!enrollment || !enrollment.active) {
        return reply.status(403).send({ error: 'You are not enrolled in this course.' });
      }
    }

    const course = await prisma.course.findUnique({
      where: { id, deletedAt: null },
      include: {
        lectures: {
          where: { deletedAt: null },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!course) return reply.status(404).send({ error: 'Course not found' });
    
    return reply.send({ course });
  });
};
