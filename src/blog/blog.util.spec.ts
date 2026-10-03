import {
  countWords,
  normalizeTags,
  readingMinutes,
  slugify,
  SLUG_PATTERN,
} from './blog.util';

describe('slugify', () => {
  it('lowercases, strips accents and joins words with single hyphens', () => {
    expect(slugify('  Héllo, Wörld!  Next.js 16 ')).toBe(
      'hello-world-next-js-16',
    );
  });

  it('cuts to the max length without leaving a trailing hyphen', () => {
    expect(slugify('abc def', 4)).toBe('abc');
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('!!! ???')).toBe('');
  });

  it('always produces a slug the validation accepts', () => {
    expect(SLUG_PATTERN.test(slugify('React Server Components: A Guide'))).toBe(
      true,
    );
  });
});

describe('readingMinutes', () => {
  it('is never less than one minute', () => {
    expect(readingMinutes('short')).toBe(1);
  });

  it('rounds up at 200 words a minute', () => {
    expect(readingMinutes('word '.repeat(200))).toBe(1);
    expect(readingMinutes('word '.repeat(201))).toBe(2);
  });

  it('counts link and image labels but not their addresses', () => {
    expect(
      countWords(
        '[read the docs](https://example.com/a/very/long/path) ![a cat](https://x.y/cat.png)',
      ),
    ).toBe(5);
  });
});

describe('normalizeTags', () => {
  it('trims, lowercases, hyphenates spaces and drops duplicates and blanks', () => {
    expect(normalizeTags([' React ', 'react', 'Next JS', ''])).toEqual([
      'react',
      'next-js',
    ]);
  });

  it('keeps at most ten tags', () => {
    const many = Array.from({ length: 12 }, (_, index) => `tag${index}`);
    expect(normalizeTags(many)).toHaveLength(10);
  });
});
