import { Injectable, ServiceUnavailableException } from '@nestjs/common';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Minimal Azure OpenAI chat client. No SDK: the chat-completions call is one
 * POST, and a dependency here would be more surface than it saves.
 */
@Injectable()
export class AzureOpenAiService {
  get isConfigured(): boolean {
    return Boolean(
      process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_DEPLOYMENT &&
      process.env.AZURE_OPENAI_API_KEY,
    );
  }

  /** Returns the assistant's raw message content, expected to be JSON. */
  async complete(messages: ChatMessage[]): Promise<string> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'The assistant is not configured on this server',
      );
    }

    const endpoint = (process.env.AZURE_OPENAI_ENDPOINT as string).replace(
      /\/$/,
      '',
    );
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT as string;
    const apiVersion =
      process.env.AZURE_OPENAI_API_VERSION ?? '2025-01-01-preview';

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    // Abort rather than hang a request thread if Azure is slow or unreachable.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_API_KEY as string,
        },
        body: JSON.stringify({
          messages,
          temperature: 0,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ServiceUnavailableException(
          `Assistant request failed (${response.status}) ${detail.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new ServiceUnavailableException('Assistant returned no content');
      }
      return content;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException('Assistant timed out');
      }
      throw new ServiceUnavailableException('Could not reach the assistant');
    } finally {
      clearTimeout(timeout);
    }
  }
}
