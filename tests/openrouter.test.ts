import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterClient } from '../scripts/lib/openrouter';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('OpenRouter reasoning retries', () => {
  it('retries a failed medium-effort request at high effort', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 400 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  approaches: [
                    {
                      id: 'a',
                      title: 'Approach',
                      summary: 'Summary.',
                      order: 0,
                      revisions: [
                        { revisionId: 1, order: 0, shortChange: 'Changed.' },
                      ],
                    },
                  ],
                }),
              },
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await new OpenRouterClient({
      OPENROUTER_API_KEY: 'test-key',
      OPENROUTER_MODEL: 'test-model',
    }).generate('prompt');

    const efforts = fetchMock.mock.calls.map(([, init]) => {
      const body = JSON.parse(String(init?.body)) as {
        reasoning: { effort: string };
      };
      return body.reasoning.effort;
    });
    expect(efforts).toEqual(['medium', 'high']);
  });
});
