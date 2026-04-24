import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

function safeParseOptions(optionsJson: string): string[] {
  try {
    const parsed = JSON.parse(optionsJson)
    if (Array.isArray(parsed)) return parsed.map(String)
    return []
  } catch {
    return []
  }
}

export default async function quizzesRoutes(fastify: FastifyInstance) {
  // POST /quizzes/:id/submit
  // Any authenticated student can submit
  fastify.post<{
    Params: { id: string }
    Body: { answers: Record<string, string> }
  }>(
    '/:id/submit',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id: quizId } = request.params
      const { answers } = request.body ?? {}
      const studentId = request.user!.userId

      if (!answers || typeof answers !== 'object') {
        return reply.status(400).send({ error: { message: 'answers must be an object' } })
      }

      // Check for duplicate submission
      const existing = await prisma.quizAttempt.findUnique({
        where: { quizId_studentId: { quizId, studentId } }
      })
      if (existing) {
        return reply.status(409).send({
          error: { message: 'You have already submitted this quiz.' }
        })
      }

      const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: {
          questions: { orderBy: { orderIndex: 'asc' } }
        }
      })

      if (!quiz) {
        return reply.status(404).send({ error: { message: 'Quiz not found' } })
      }

      // Score answers — compare by trimmed string equality
      let correctCount = 0
      const results = quiz.questions.map(q => {
        const studentAnswer = (answers[q.id] ?? '').trim()
        const isCorrect = studentAnswer === q.correctAnswer.trim()
        if (isCorrect) correctCount++

        return {
          questionId:    q.id,
          questionText:  q.questionText,
          options:       safeParseOptions(q.options),
          studentAnswer,
          correctAnswer: q.correctAnswer,
          explanation:   q.explanation,
          isCorrect,
        }
      })

      const score = quiz.questions.length > 0
        ? (correctCount / quiz.questions.length) * 100
        : 0

      await prisma.quizAttempt.create({
        data: {
          quizId,
          studentId,
          answers: JSON.stringify(answers),
          score,
        }
      })

      return reply.send({
        score,
        correctCount,
        totalQuestions: quiz.questions.length,
        results,
      })
    }
  )
}
