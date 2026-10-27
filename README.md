# Paperwork

Browser-based PDF tools built with React, TypeScript, and Vite.

## Development

Use Node.js 24.22 or newer and pnpm 12.11.2.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Preparation scripts copy pdf.js resources and download pinned fonts. PDF
processing runs in the browser.

## Validation

```sh
pnpm test
pnpm build
```

## Cloudflare Workers deployment

The `paperwork` Worker belongs to the Personal Cloudflare account, selected in
`cloudflare.config.ts`. Vite produces static assets in `.cloudflare/output/v0`;
unknown navigation paths fall back to the SPA entry point.

```sh
pnpm build
pnpm deploy
```

Production URL: https://paperwork.c-teerakit.workers.dev

## Social sharing and search metadata

`src/lib/social.ts` defines the production URL, page titles, descriptions, and
social tags. The Vite plugin in `scripts/social-metadata.ts` writes metadata
directly into HTML for the home page, About page, and each PDF tool, so link
crawlers do not need JavaScript. It also generates `sitemap.xml` and `robots.txt`.
Client navigation updates the same metadata through `PageMetadata`.

The shared 1200 × 630 preview image is `public/og.png`. To regenerate it after
changing the artwork in `scripts/generate-social-image.mjs`, run:

```sh
node scripts/generate-social-image.mjs
```

If the production domain changes, update `SITE_URL` before building.

## Feedback

The header's Feedback dialog sends messages through `POST /api/feedback` to
Discord. It sends only the message, with no PDF attachments. Submissions are
limited to 1,500 characters and three requests per minute per IP.

Set `DISCORD_FEEDBACK_WEBHOOK` in the gitignored `.dev.vars` file for local
development. For production, set the same Worker secret before deploying:

```sh
pnpm dlx wrangler secret put DISCORD_FEEDBACK_WEBHOOK --name paperwork
```

Keep the webhook out of source control and client-side environment variables.

Workers Builds settings for the GitHub integration:

- Production branch: `main`
- Root directory: `/`
- Build command: `pnpm test && pnpm build`
- Deploy command: `pnpm deploy`
- Build environment: `NODE_VERSION=24.22.0`, `PNPM_VERSION=12.11.2`

Cloudflare manages repository access and deployment credentials. Do not commit
API tokens or local environment files.
