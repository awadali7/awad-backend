Core Web Vitals are three numbers Google uses to judge how a page feels to real visitors. Next.js handles a lot of the work, but a few settings decide whether a site passes or fails.

## The three metrics

| Metric | Measures | Good |
| --- | --- | --- |
| LCP | How fast the main content appears | 2.5 s or less |
| INP | How quickly the page responds to input | 200 ms or less |
| CLS | How much the layout jumps around | 0.1 or less |

## Largest Contentful Paint

The largest element is usually a hero image or a headline. Load that image first and let everything below the fold wait.

```tsx
<Image
  src={post.coverImage}
  alt={post.coverAlt}
  width={1200}
  height={630}
  priority
/>
```

Also keep animations that hide content until scripts run away from the main content. Text that starts invisible counts as late text.

## Interaction to Next Paint

Slow interactions almost always come from too much JavaScript on the main thread.

- Render on the server whatever does not need interactivity.
- Split heavy widgets such as editors and charts with dynamic imports.
- Break long loops and large state updates into smaller pieces.

## Cumulative Layout Shift

Layout shifts happen when the browser learns a size too late.

- Give every image and embed a width and height.
- Load fonts with `next/font`, which removes the shift when the font swaps.
- Reserve space for banners and ads before they arrive.

## Measure real visitors

Lab tools are a starting point, but the score that counts comes from real visits. Check the Core Web Vitals report in Search Console after each release, because it shows which page groups need attention first.
