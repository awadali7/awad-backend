Caching is the part of the App Router that surprises people most. A page that should update stays stale, or a page that should be fast hits the database on every request. Most of that confusion goes away once you know which layer is doing the caching.

## The four layers

| Layer | Where it lives | What it keeps |
| --- | --- | --- |
| Request memoization | Server, one request | Repeated `fetch` calls in a single render |
| Data cache | Server, across requests | `fetch` results you opt in to caching |
| Full route cache | Server | Rendered HTML and payload of static routes |
| Router cache | Browser | Route segments visited during a session |

Each layer answers a different question. Memoization stops one render from asking the same thing twice. The data cache shares answers between visitors. The route cache skips rendering entirely. The router cache makes back and forward navigation instant.

## What changed in Next.js 15

Since Next.js 15, `fetch` requests are not cached by default. If you want a response kept between requests, say so explicitly:

```ts
// Kept until something revalidates it
const posts = await fetch('https://api.example.com/posts', {
  cache: 'force-cache',
});

// Kept, but refreshed at most once an hour
const stats = await fetch('https://api.example.com/stats', {
  next: { revalidate: 3600 },
});
```

Being explicit is a good trade. You can read a component and know how fresh its data is without remembering a framework default.

## Revalidate when the data changes

A timer is a safety net. For content you own, refresh the cache the moment it changes:

```ts
'use server';

import { revalidatePath } from 'next/cache';

export async function publishPost(slug: string) {
  await savePostAsPublished(slug);
  revalidatePath('/blog/' + slug);
}
```

The page is rebuilt on the next request, so readers never wait for a timer to expire.

## A rule of thumb

- Cache anything that looks the same for every visitor.
- Revalidate when you write, not on a schedule, if you own the data.
- Keep anything personal out of shared caches entirely.
