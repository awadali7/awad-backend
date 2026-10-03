/** Lowercase letters and digits joined by single hyphens: "nextjs-caching". */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Post slugs that would collide with a portfolio route under /blog. A post at
 * /blog/category would sit on the parent path of the category pages.
 */
export const RESERVED_POST_SLUGS = ['category'];

export const WORDS_PER_MINUTE = 200;
export const MAX_TAGS = 10;

/** "Hello, Wörld!" -> "hello-world". Empty when nothing usable is left. */
export function slugify(text: string, maxLength = 80): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/**
 * Words a reader actually reads: link and image targets are dropped (their
 * labels stay) and markdown punctuation doesn't count as a word.
 */
export function countWords(markdown: string): number {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Whole minutes at 200 words a minute, never less than one. */
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.ceil(countWords(markdown) / WORDS_PER_MINUTE));
}

/** Trimmed, lowercase, spaces turned into hyphens, de-duplicated, capped. */
export function normalizeTags(tags: string[]): string[] {
  const unique = new Set<string>();
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag) unique.add(tag);
  }
  return [...unique].slice(0, MAX_TAGS);
}
