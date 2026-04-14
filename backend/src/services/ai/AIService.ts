// ─────────────────────────────────────────────────────────────────────────────
// AI Service Abstraction — spec Section 6
//
// Define the interface first. Then implement providers.
// Routes always receive AIProvider — never a concrete class.
// Swap providers by changing env.AI_PROVIDER — zero route changes.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Shared types ────────────────────────────────────────────────────────────

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

// ─── Prompt helpers ──────────────────────────────────────────────────────────

function loadPrompt(filename: string, variables: Record<string, string>): string {
  // import.meta.url works in both dev (tsx) and compiled ESM
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const promptPath = join(currentDir, 'prompts', filename);

  let template: string;
  try {
    template = readFileSync(promptPath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to load prompt file: ${promptPath}. Error: ${err}`);
  }

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }
  return template;
}

export function getPromptVersion(summaryType: string): string {
  const map: Record<string, string> = {
    'BRIEF':         'summarize-brief.v1',
    'FULL':          'summarize-full.v1',
    'BULLET_POINTS': 'summarize-bullets.v1',
  };
  return map[summaryType] ?? 'summarize-brief.v1';
}

function getPromptFilename(summaryType: string): string {
  const map: Record<string, string> = {
    'BRIEF':         'summarize-brief.v1.txt',
    'FULL':          'summarize-full.v1.txt',
    'BULLET_POINTS': 'summarize-bullets.v1.txt',
  };
  return map[summaryType] ?? 'summarize-brief.v1.txt';
}

// ─── Transcript preparation ──────────────────────────────────────────────────

function prepareTranscriptText(transcript: { rawContent: string; processedContent: string | null }): string {
  const text = transcript.processedContent ?? transcript.rawContent;
  const MAX_CHARS = 12000;

  if (text.length <= MAX_CHARS) return text;

  // Truncate at sentence boundary
  const truncated = text.slice(0, MAX_CHARS);
  const lastPeriod = truncated.lastIndexOf('.');
  const cutPoint = lastPeriod > MAX_CHARS * 0.85 ? lastPeriod + 1 : MAX_CHARS;

  return truncated.slice(0, cutPoint) + '\n\n[Transcript truncated for length — remaining content omitted]';
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

// ─────────────────────────────────────────────────────────────────────────────
// K2Provider — K2 Think V2 (MBZUAI)
// Primary AI provider for Antigravity LMS.
// Uses the OpenAI-compatible chat completions API with native fetch.
// ─────────────────────────────────────────────────────────────────────────────

export class K2Provider implements AIProvider {
  private readonly apiKey:  string;
  private readonly model:   string;
  private readonly baseUrl: string;

  constructor(apiKey: string, model?: string, baseUrl?: string) {
    this.apiKey  = apiKey;
    this.model   = model   ?? 'MBZUAI-IFM/K2-Think-v2';
    this.baseUrl = (baseUrl ?? 'https://api.k2think.ai/v1').replace(/\/$/, ''); // strip trailing slash
  }

  // ── Core completion ───────────────────────────────────────────────────────

  private async complete(prompt: string, attempt = 1): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const MAX_ATTEMPTS = 3;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept':        'application/json',
        },
        body: JSON.stringify({
          model:    this.model,
          messages: [{ role: 'user', content: prompt }],
          stream:   false,
        }),
        // 90 second timeout — summaries can take time on large transcripts
        signal: AbortSignal.timeout(90_000),
      });
    } catch (err) {
      // Network error or timeout
      if (attempt < MAX_ATTEMPTS) {
        const delay = attempt * 2000; // 2s, 4s backoff
        console.warn(`K2Provider: network error on attempt ${attempt}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.complete(prompt, attempt + 1);
      }
      throw new Error(`K2Provider: network error after ${MAX_ATTEMPTS} attempts: ${err}`);
    }

    // Rate limit — retry with exponential backoff
    if (response.status === 429) {
      if (attempt < MAX_ATTEMPTS) {
        const retryAfter = parseInt(response.headers.get('retry-after') ?? '10', 10);
        const delay = Math.max(retryAfter * 1000, attempt * 5000);
        console.warn(`K2Provider: rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.complete(prompt, attempt + 1);
      }
      throw new Error('K2Provider: rate limit exceeded after retries');
    }

    // Server errors — retry
    if (response.status >= 500) {
      if (attempt < MAX_ATTEMPTS) {
        const delay = attempt * 3000;
        console.warn(`K2Provider: server error ${response.status} on attempt ${attempt}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.complete(prompt, attempt + 1);
      }
      const body = await response.text().catch(() => '');
      throw new Error(`K2Provider: server error ${response.status} after ${MAX_ATTEMPTS} attempts: ${body}`);
    }

    // Client errors — do not retry (bad request, auth failure, etc.)
    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown error');
      throw new Error(`K2Provider: API error ${response.status}: ${body}`);
    }

    // Parse response
    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(`K2Provider: API returned error: ${data.error.message}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content || content.trim() === '') {
      throw new Error('K2Provider: API returned empty content');
    }

    // K2-Think-v2 includes <think> reasoning in the response — strip it
    let cleanContent = content.trim();
    const thinkEnd = cleanContent.lastIndexOf('</think>');
    if (thinkEnd !== -1) {
      cleanContent = cleanContent.slice(thinkEnd + '</think>'.length).trim();
    }

    return cleanContent;
  }

  // ── AIProvider interface ──────────────────────────────────────────────────

  async summarize(transcript: string, options?: SummarizeOptions): Promise<string> {
    const type = options?.type ?? 'BRIEF';
    const filename = getPromptFilename(type);
    const prompt = loadPrompt(filename, { TRANSCRIPT: transcript });
    return this.complete(prompt);
  }

  async generateQuiz(content: string, questionCount: number): Promise<QuizQuestion[]> {
    // Not yet implemented — Phase 3 Step 3.2
    // Returns empty array instead of throwing — JobWorker must not crash
    console.warn('K2Provider.generateQuiz: not yet implemented, returning empty array');
    return [];
  }

  async embed(text: string): Promise<number[]> {
    // K2 Think V2 does not expose an embeddings endpoint
    // Returns empty array instead of throwing — embedding search is post-pilot
    console.warn('K2Provider.embed: not yet implemented, returning empty array');
    return [];
  }
}

// Re-export prepareTranscriptText for use by JobWorker
export { prepareTranscriptText };
