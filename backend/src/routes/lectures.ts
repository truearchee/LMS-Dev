import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { StorageService } from '../services/storage/StorageService.js';

import { AIProvider } from '../services/ai/AIService.js';

function safeParseOptions(optionsJson: string): string[] {
  try {
    const parsed = JSON.parse(optionsJson)
    if (Array.isArray(parsed)) return parsed.map(String)
    return []
  } catch {
    return []
  }
}

function sanitizeQuizForStudent(quiz: {
  id: string
  lectureId: string
  createdAt: Date
  questions: Array<{
    id: string
    questionText: string
    questionType: string
    options: string
    orderIndex: number
  }>
}) {
  return {
    id:        quiz.id,
    lectureId: quiz.lectureId,
    createdAt: quiz.createdAt,
    questions: quiz.questions.map(q => ({
      id:           q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      options:      safeParseOptions(q.options),
      orderIndex:   q.orderIndex,
    }))
  }
}

// Factory — injects StorageService so the route has no knowledge of the backend
export function makeLectureRoutes(storage: StorageService, ai: AIProvider) {
  return async (fastify: FastifyInstance) => {

    // ── GET /api/v1/lectures/:id ──────────────────────────────────────────────
    // Access: enrolled students, teacher of the course, admin
    fastify.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!request.user) return reply.status(401).send();
      const { userId, role } = request.user;

      const lecture = await prisma.lecture.findUnique({
        where: { id, deletedAt: null },
        include: {
          files:       { orderBy: { createdAt: 'asc' } },
          transcripts: { select: { id: true, source: true, status: true, createdAt: true } },
          aiSummaries: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true, type: true, content: true, modelUsed: true, promptVersion: true, createdAt: true,
            },
          },
        },
      });

      if (!lecture) return reply.status(404).send({ error: 'Lecture not found.' });

      // Students must be enrolled in the parent course
      if (role === 'STUDENT') {
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId: lecture.courseId } },
        });
        if (!enrollment?.active) {
          return reply.status(403).send({ error: 'You are not enrolled in this course.' });
        }
      }

      return reply.send({ lecture });
    });

    // ── POST /api/v1/lectures/:id/files/register ──────────────────────────────
    // JSON body — TEACHER registers an already-uploaded file URL.
    // Must be registered BEFORE /:id/files to avoid Fastify route conflict.
    fastify.post(
      '/:id/files/register',
      { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const { type, label, url, mimeType, sizeBytes } = request.body as {
          type: string;
          label?: string;
          url: string;
          mimeType?: string;
          sizeBytes?: number;
        };

        if (!url)  return reply.status(400).send({ error: 'url is required.' });
        if (!type) return reply.status(400).send({ error: 'type is required.' });

        const lecture = await prisma.lecture.findUnique({ where: { id, deletedAt: null } });
        if (!lecture) return reply.status(404).send({ error: 'Lecture not found.' });

        const file = await prisma.lectureFile.upsert({
          where: {
            lectureId_type: {
              lectureId: id,
              type,
            },
          },
          create: { lectureId: id, url, type, label, mimeType, sizeBytes },
          update: { url, label, mimeType, sizeBytes },
        });

        return reply.status(201).send({ file });
      },
    );

    // ── POST /api/v1/lectures/:id/files ───────────────────────────────────────
    // Multipart upload — TEACHER uploads a binary file directly
    fastify.post(
      '/:id/files',
      { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };

        const lecture = await prisma.lecture.findUnique({ where: { id, deletedAt: null } });
        if (!lecture) return reply.status(404).send({ error: 'Lecture not found.' });

        const data = await request.file();
        if (!data) return reply.status(400).send({ error: 'No file provided.' });

        // Collect stream into buffer so StorageService can handle it uniformly
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) chunks.push(chunk as Buffer);
        const buffer = Buffer.concat(chunks);

        const url = await storage.upload(buffer, data.filename, data.mimetype);

        // Infer file type from mimetype
        const type =
          data.mimetype === 'application/pdf' ? 'SLIDES'
          : data.mimetype.startsWith('video/') ? 'RECORDING'
          : 'OTHER';

        const file = await prisma.lectureFile.upsert({
          where: {
            lectureId_type: {
              lectureId: id,
              type,
            },
          },
          create: {
            lectureId: id,
            url,
            type,
            label:     data.filename,
            mimeType:  data.mimetype,
            sizeBytes: buffer.byteLength,
          },
          update: {
            url,
            label:     data.filename,
            mimeType:  data.mimetype,
            sizeBytes: buffer.byteLength,
          },
        });

        return reply.status(201).send({ file });
      },
    );
    // ── PATCH /api/v1/lectures/:id/note ─────────────────────────────────────
    // Access: TEACHER/ADMIN
    fastify.patch<{
      Params: { id: string }
      Body: { teacherNote: string }
    }>(
      '/:id/note',
      { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params;
        const { teacherNote } = request.body;

        const lecture = await prisma.lecture.update({
          where: { id },
          data: { teacherNote },
        });

        return reply.send({ message: 'Note updated successfully', lecture });
      }
    );

    // ── DELETE /api/v1/lectures/:id/files/:fileId ───────────────────────────
    // Access: TEACHER/ADMIN
    fastify.delete<{
      Params: { id: string; fileId: string }
    }>(
      '/:id/files/:fileId',
      { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
      async (request, reply) => {
        const { id: lectureId, fileId } = request.params;

        const file = await prisma.lectureFile.findFirst({
          where: { id: fileId, lectureId },
        });

        if (!file) {
          return reply.status(404).send({ error: { message: 'File not found' } });
        }

        await prisma.lectureFile.delete({ where: { id: fileId } });
        return reply.status(204).send();
      }
    );

    // ── POST /api/v1/lectures/:id/generate-quiz ───────────────────────────────
    // Teacher triggers quiz generation
    fastify.post<{
      Params: { id: string }
      Body: { questionCount?: number }
    }>(
      '/:id/generate-quiz',
      { preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')] },
      async (request, reply) => {
        const COOLDOWN_MS           = 5 * 60 * 1000  // 5 minutes
        const AI_GENERATION_TIMEOUT_MS = 120_000      // 120 seconds

        const { id: lectureId } = request.params
        const questionCount = Math.min(Math.max(Number(request.body?.questionCount) || 8, 5), 15)

        const lecture = await prisma.lecture.findUnique({
          where: { id: lectureId },
          include: {
            transcripts: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            quizzes: {
              include: {
                questions: { select: { questionText: true } }
              }
            }
          }
        })

        if (!lecture) {
          return reply.status(404).send({ error: { message: 'Lecture not found' } })
        }

        const transcript = lecture.transcripts[0]
        if (!transcript) {
          return reply.status(400).send({
            error: { message: 'No transcript found for this lecture. Upload a transcript first.' }
          })
        }

        // ── Part C: Cooldown check — prevent rapid re-generation ────────────
        // Checked AFTER transcript validation so missing-transcript still returns 400
        const recentQuiz = await prisma.quiz.findFirst({
          where: {
            lectureId,
            createdAt: { gte: new Date(Date.now() - COOLDOWN_MS) }
          },
          orderBy: { createdAt: 'desc' },
        })

        if (recentQuiz) {
          const secondsAgo = Math.floor((Date.now() - recentQuiz.createdAt.getTime()) / 1000)
          const retryAfterSeconds = Math.ceil((COOLDOWN_MS - (Date.now() - recentQuiz.createdAt.getTime())) / 1000)
          const minutesRemaining  = Math.ceil(retryAfterSeconds / 60)
          return reply.status(429).send({
            error: {
              message: `A quiz was generated ${secondsAgo} seconds ago. Please wait ${minutesRemaining} more minute(s) before generating another.`,
              retryAfterSeconds,
            }
          })
        }

        const transcriptContent = transcript.processedContent ?? transcript.rawContent
        const existingQuestions = lecture.quizzes.flatMap(q =>
          q.questions.map(qq => qq.questionText)
        )

        // PRODUCTION NOTE: This is a synchronous AI call.
        // Our architecture uses ECS Fargate + ALB. ALB idle timeout defaults to 60s and must be configured to 130s before deployment.
        // Long-term fix: move to async job queue (Phase 6 — same pattern as summarization)
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_GENERATION_TIMEOUT_MS)
        )

        let questionData
        try {
          questionData = await Promise.race([
            ai.generateQuiz(transcriptContent, questionCount, existingQuestions),
            timeoutPromise,
          ])
        } catch (err: any) {
          if (err?.message === 'AI_TIMEOUT') {
            return reply.status(503).send({
              error: {
                message: 'Quiz generation is taking longer than expected. The transcript may be too long. Try again in a moment.',
                code: 'AI_TIMEOUT',
              }
            })
          }
          return reply.status(502).send({
            error: {
              message: `Quiz generation failed: ${err?.message ?? 'Unknown AI error'}`,
              code: 'AI_ERROR',
            }
          })
        }

        if (questionData.length === 0) {
          return reply.status(500).send({
            error: { message: 'AI failed to generate valid questions. Please try again.' }
          })
        }

        // ── Part D: Atomic check-and-create — prevents race conditions ──────
        // Two simultaneous requests can both pass the cooldown check above.
        // The transaction re-checks inside a 10-second window so only one wins.
        let quiz
        try {
          quiz = await prisma.$transaction(async (tx) => {
            const concurrentQuiz = await tx.quiz.findFirst({
              where: {
                lectureId,
                createdAt: { gte: new Date(Date.now() - 10_000) }  // 10 second window
              }
            })

            if (concurrentQuiz) {
              throw new Error('CONCURRENT_GENERATION')
            }

            return tx.quiz.create({
              data: {
                lectureId,
                modelUsed:     process.env.AI_MODEL ?? 'unknown',
                promptVersion: 'quiz-generate.v1',
                questions: {
                  create: questionData.map(q => ({
                    questionText:  q.questionText,
                    questionType:  q.questionType,
                    options:       q.options,
                    correctAnswer: q.correctAnswer,
                    explanation:   q.explanation,
                    orderIndex:    q.orderIndex,
                  }))
                }
              },
              include: {
                questions: { orderBy: { orderIndex: 'asc' } }
              }
            })
          })
        } catch (err: any) {
          if (err?.message === 'CONCURRENT_GENERATION') {
            return reply.status(429).send({
              error: { message: 'A quiz is already being generated for this lecture. Please try again shortly.' }
            })
          }
          throw err
        }

        return reply.status(201).send({ quiz })
      }
    )

    // ── GET /api/v1/lectures/:id/quiz ─────────────────────────────────────────
    // Student gets next available quiz
    fastify.get<{ Params: { id: string } }>(
      '/:id/quiz',
      { preHandler: [requireAuth] },
      async (request, reply) => {
        const { id: lectureId } = request.params
        const studentId = request.user!.userId

        // Find quizzes this student has already attempted
        const attempts = await prisma.quizAttempt.findMany({
          where: { studentId },
          select: { quizId: true }
        })
        const attemptedIds = new Set(attempts.map(a => a.quizId))

        // Get all quizzes for this lecture with questions (no correct answers selected)
        const allQuizzes = await prisma.quiz.findMany({
          where: { lectureId },
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id:           true,
                questionText: true,
                questionType: true,
                options:      true,
                orderIndex:   true,
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        })

        // Find first quiz student hasn't attempted
        const untaken = allQuizzes.find(q => !attemptedIds.has(q.id))

        if (untaken) {
          return reply.send({
            quiz:      sanitizeQuizForStudent(untaken),
            isNew:     false,
            poolSize:  allQuizzes.length,
          })
        }

        // All quizzes exhausted — auto-generate a new one
        const lecture = await prisma.lecture.findUnique({
          where: { id: lectureId },
          include: {
            transcripts: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            }
          }
        })

        if (!lecture?.transcripts[0]) {
          return reply.status(404).send({
            error: { message: 'No quizzes available and no transcript to generate from.' }
          })
        }

        const transcriptContent =
          lecture.transcripts[0].processedContent ?? lecture.transcripts[0].rawContent

        // Pass ALL existing question texts to avoid duplication
        const allExistingQuestions = allQuizzes.flatMap(q =>
          q.questions.map((qq: any) => qq.questionText)
        )

        const questionData = await ai.generateQuiz(
          transcriptContent,
          8,
          allExistingQuestions
        )

        const newQuiz = await prisma.quiz.create({
          data: {
            lectureId,
            modelUsed:     process.env.AI_MODEL ?? 'unknown',
            promptVersion: 'quiz-generate.v1',
            questions: {
              create: questionData.map(q => ({
                questionText:  q.questionText,
                questionType:  q.questionType,
                options:       q.options,
                correctAnswer: q.correctAnswer,
                explanation:   q.explanation,
                orderIndex:    q.orderIndex,
              }))
            }
          },
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id:           true,
                questionText: true,
                questionType: true,
                options:      true,
                orderIndex:   true,
              }
            }
          }
        })

        return reply.send({
          quiz:     sanitizeQuizForStudent(newQuiz),
          isNew:    true,
          poolSize: allQuizzes.length + 1,
        })
      }
    )

    // ── GET /api/v1/lectures/:id/quiz-history ─────────────────────────────────
    fastify.get<{ Params: { id: string } }>(
      '/:id/quiz-history',
      { preHandler: [requireAuth] },
      async (request, reply) => {
        const { id: lectureId } = request.params
        const studentId = request.user!.userId

        const attempts = await prisma.quizAttempt.findMany({
          where: {
            studentId,
            quiz: { lectureId }
          },
          include: {
            quiz: {
              select: {
                id:        true,
                createdAt: true,
                _count:    { select: { questions: true } }
              }
            }
          },
          orderBy: { takenAt: 'desc' }
        })

        return reply.send({
          attempts: attempts.map(a => ({
            attemptId:      a.id,
            quizId:         a.quizId,
            score:          a.score,
            takenAt:        a.takenAt,
            totalQuestions: a.quiz._count.questions,
          }))
        })
      }
    )
  };
}
