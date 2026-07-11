import { describe, it, expect } from 'vitest';
import { validateNarrative } from '../scripts/lib/schemas';
import {
  NARRATIVE_INSTRUCTIONS,
  shouldRequestLlm,
} from '../scripts/lib/narrative';
const rev = (sha: string, order = 0) => ({
  sha,
  order,
  shortChange: 'Changed.',
});
const result = (revisions: ReturnType<typeof rev>[]) => ({
  approaches: [
    { id: 'a', title: 'Approach', summary: 'Summary', order: 0, revisions },
  ],
});
describe('narrative validation', () => {
  it('accepts complete output', () =>
    expect(
      validateNarrative(result([rev('a'), rev('b', 1)]), ['a', 'b']).approaches,
    ).toHaveLength(1));
  it('rejects missing SHA', () =>
    expect(() => validateNarrative(result([rev('a')]), ['a', 'b'])).toThrow(
      'Missing',
    ));
  it('rejects duplicate SHA', () =>
    expect(() =>
      validateNarrative(result([rev('a'), rev('a', 1)]), ['a']),
    ).toThrow('Duplicate SHA'));
  it('rejects unknown SHA', () =>
    expect(() => validateNarrative(result([rev('x')]), ['a'])).toThrow(
      'Unknown',
    ));
  it('rejects duplicate IDs', () =>
    expect(() =>
      validateNarrative(
        {
          approaches: [
            ...result([rev('a')]).approaches,
            { ...result([rev('b')]).approaches[0] },
          ],
        },
        ['a', 'b'],
      ),
    ).toThrow('Duplicate approach'));
  it('rejects duplicate ordering', () =>
    expect(() =>
      validateNarrative(result([rev('a'), rev('b')]), ['a', 'b']),
    ).toThrow('Duplicate revision order'));
});

describe('LLM request policy', () => {
  it('skips single-revision groups', () => {
    expect(shouldRequestLlm(1)).toBe(false);
  });

  it('analyzes groups with multiple revisions', () => {
    expect(shouldRequestLlm(2)).toBe(true);
  });
});

describe('narrative prompt policy', () => {
  const instructions = NARRATIVE_INSTRUCTIONS.join(' ');

  it('defines revisions as improvements within the same strategy', () => {
    expect(instructions).toContain('time or space complexity');
    expect(instructions).toContain('more idiomatic');
    expect(instructions).toContain(
      'general solution strategy remains the same',
    );
  });

  it('defines approaches as materially different strategies', () => {
    expect(instructions).toContain('fundamentally different algorithm');
    expect(instructions).toContain(
      'core way of solving the problem materially changes',
    );
  });

  it('requires exactly one entry for every SHA', () => {
    expect(instructions).toContain('exactly once');
    expect(instructions).toContain('Never duplicate a SHA');
  });
});
