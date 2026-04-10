// ─────────────────────────────────────────────────────────────────────────────
// AI Service Abstraction — spec Section 6
//
// Define the interface first. Then implement providers.
// Routes always receive AIProvider — never a concrete class.
// Swap providers by changing env.AI_PROVIDER — zero route changes.
// ─────────────────────────────────────────────────────────────────────────────

export interface SummarizeOptions {
  type: 'BRIEF' | 'FULL' | 'BULLET_POINTS';
  promptVersion?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];       // 4 options, A–D
  correctIndex: number;    // 0-indexed
  explanation?: string;
}

export interface AIProvider {
  summarize(transcript: string, options?: SummarizeOptions): Promise<string>;
  generateQuiz(content: string, questionCount: number): Promise<QuizQuestion[]>;
  embed(text: string): Promise<number[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MockAIProvider
// Used in development when no API key is configured.
// All AI pipeline code runs end-to-end — just with deterministic fake output.
// ─────────────────────────────────────────────────────────────────────────────

export class MockAIProvider implements AIProvider {
  async summarize(transcript: string, options?: SummarizeOptions): Promise<string> {
    const type = options?.type ?? 'BRIEF';
    return `[MOCK ${type} SUMMARY] Received ${transcript.length} characters. This is a placeholder summary for development.`;
  }

  async generateQuiz(content: string, questionCount: number): Promise<QuizQuestion[]> {
    return Array.from({ length: questionCount }, (_, i) => ({
      question: `[MOCK] Question ${i + 1} about the provided content (${content.length} chars).`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      explanation: '[MOCK] This is a placeholder explanation.',
    }));
  }

  async embed(text: string): Promise<number[]> {
    // Return a fixed-length zero vector — shape is correct, values are not real
    return Array(1536).fill(0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAIProvider — implement when AI_API_KEY is available
// ─────────────────────────────────────────────────────────────────────────────

export class OpenAIProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async summarize(transcript: string, options?: SummarizeOptions): Promise<string> {
    // TODO: implement with openai sdk
    // const openai = new OpenAI({ apiKey: this.apiKey });
    // const response = await openai.chat.completions.create({ ... });
    throw new Error('OpenAIProvider not yet implemented — set AI_API_KEY and install openai package');
  }

  async generateQuiz(content: string, questionCount: number): Promise<QuizQuestion[]> {
    throw new Error('OpenAIProvider not yet implemented');
  }

  async embed(text: string): Promise<number[]> {
    throw new Error('OpenAIProvider not yet implemented');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AnthropicProvider — implement when AI_API_KEY is available
// ─────────────────────────────────────────────────────────────────────────────

export class AnthropicProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async summarize(transcript: string, options?: SummarizeOptions): Promise<string> {
    // TODO: implement with @anthropic-ai/sdk
    throw new Error('AnthropicProvider not yet implemented — set AI_API_KEY and install @anthropic-ai/sdk');
  }

  async generateQuiz(content: string, questionCount: number): Promise<QuizQuestion[]> {
    throw new Error('AnthropicProvider not yet implemented');
  }

  async embed(text: string): Promise<number[]> {
    throw new Error('AnthropicProvider not yet implemented');
  }
}
