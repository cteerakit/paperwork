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

Workers Builds settings for the GitHub integration:

- Production branch: `main`
- Root directory: `/`
- Build command: `pnpm test && pnpm build`
- Deploy command: `pnpm deploy`
- Build environment: `NODE_VERSION=24.22.0`, `PNPM_VERSION=12.11.2`

Cloudflare manages repository access and deployment credentials. Do not commit
API tokens or local environment files.
