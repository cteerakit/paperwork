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

## Install and offline use

On HTTPS (or localhost), use the browser's Install app action. On iOS, use
Share → Add to Home Screen. The installed app opens in its own window.

The production build caches the app, all PDF tools, PDF engines, and standard
fonts after the first online visit finishes downloading. Chinese, Japanese,
and Korean editing fonts are cached on first use; use the desired font online
once before relying on it offline. Feedback requires a connection. PDFs are
processed locally and are never added to the service worker cache for reuse.

The installed app can open PDFs from the operating system (File Handling, in
browsers that support it) and receive PDFs shared from other apps (Web Share
Target). Both land on `/open`, where you choose a tool. Shared files arrive as a
POST request that `public/share-target-sw.js` (loaded into the generated service
worker) answers: it parks the files in a cache for the instant it takes the page
to read and delete them, and the app clears that cache again on startup. Open
and share only work from a production build, since service workers are disabled
during `pnpm dev`.

Updates activate after all open app windows close, so editing is not interrupted.
Service workers are disabled during `pnpm dev`; validate offline behavior with
a production build. Regenerate install icons with
`node scripts/generate-pwa-icons.mjs` after changing the favicon artwork.

## Cloudflare Workers deployment

The `paperwork` Worker belongs to the Personal Cloudflare account, selected in
`cloudflare.config.ts`. Vite produces static assets in `.cloudflare/output/v0`;
public routes serve generated HTML and unknown paths return a custom HTTP 404.

```sh
pnpm build
pnpm deploy
```

Production URL: https://paperwork.tools

## Social sharing and search metadata

`src/lib/social.ts` defines the production URL, page titles, descriptions, and
social tags. The Vite plugin in `scripts/social-metadata.ts` writes metadata
directly into HTML for all 14 public pages. `src/entry-static.tsx` renders the
same React pages, tool headings, and translated guides used by the live app,
so crawlers can read content and follow links without JavaScript. PDF workspaces
load on the client and replace their static placeholder. Generated HTML is
English; the existing language switch also translates the new guides into Thai.

The build also emits WebSite and WebApplication JSON-LD (WebSite sets the site
name Google shows in results), `sitemap.xml`, `robots.txt`, and
a `noindex` 404 page. Client navigation updates the same metadata through
`PageMetadata`, including restoring indexable metadata when leaving a missing
page. Cloudflare drops trailing slashes to match canonical URLs. The service
worker’s navigation fallback is limited to known public routes.

Validate the generated files after building:

```sh
pnpm build
pnpm check:seo
```

After deploying, verify the production URL as a URL-prefix property in Google
Search Console, then submit `https://paperwork.tools/sitemap.xml`
in its Sitemaps report. Use URL Inspection to check the home page and a tool
page; monitor Page Indexing for unexpected exclusions or soft 404s. Search
Console verification and submission are account actions performed separately.

The shared 1200 × 630 preview image is `public/og.png`. To regenerate it after
changing the artwork in `scripts/generate-social-image.mjs`, run:

```sh
node scripts/generate-social-image.mjs
```

If the production domain changes, update `SITE_URL` before building.

## Feedback

The header's Feedback button opens the [Shipped](https://shipped.tools)
feedback widget (`index.html`, widget `pcgALWgkYiQB`, `data-launcher="none"`).
The form runs in an iframe on shipped.tools and loads only when opened; it
never sees PDFs. `public/_headers` allows `https://shipped.tools` in
`script-src` and `frame-src` for it.

Workers Builds settings for the GitHub integration:

- Production branch: `main`
- Root directory: `/`
- Build command: `pnpm test && pnpm build`
- Deploy command: `pnpm deploy`
- Build environment: `NODE_VERSION=24.22.0`, `PNPM_VERSION=12.11.2`

Cloudflare manages repository access and deployment credentials. Do not commit
API tokens or local environment files.
