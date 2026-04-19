# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frontend for EPUB ebook processing. The Brand name is Pergament. It is a web-based application that allows users to upload EPUB files and process them.

The frontend is built with Next.js 16 and React 19. The domain will be pergament.si.

Core backend capabilities: 
- EPUB parsing (EbookLib)
- image processing (Pillow, pdf2image)
- and OCR (pytesseract/Tesseract)

The core idea is to provide a web-based interface for processing EPUB files. Uploading files and sending them to the backend for processing will trigger the processing pipeline.
The backend will then return the processed EPUB file to the frontend for download.
The frontend will display the processed EPUB file in a web browser.
The user can then download the processed EPUB file, after payments.

## Payment structure

- Per page pricing, with a minimum of 20 pages.
- Payments are made via Stripe.
- The user is charged a fixed amount for each page.
- The user is charged a fixed amount for the total number of pages.
- The price is 0.15 EUR per page.

### MVP features
- Mobile-only scan flow: user takes one photo per page using the device camera with a fixed 1:√2 crop guide overlay. Cropped JPEGs are POSTed to `/api/upload` as a single multipart request (`files` field, repeated).
- Desktop shows a QR-code handoff (`DesktopHandoff`) pointing at `/scan`; it does not attempt to capture.
- Payments via Stripe after scanning (reuses `/convert/{sessionId}` flow).
- Backend emails the finished EPUB; no downloads in the frontend.
- AVOID user accounts.

## Commands

```bash
npm run dev      # Start dev server (Turbopack, default in v16)
npm run build    # Production build (Turbopack, default in v16)
npm run start    # Start production server
npm run lint     # Run ESLint directly (next lint was removed in v16)
```

There are no tests configured yet.

## Architecture

- **Framework**: Next.js 16.2.3 with React 19.2.4, App Router only (no Pages Router)
- **Source root**: `src/` — the `@/*` path alias maps to `./src/*`
- **Entry points**: `src/app/[locale]/layout.tsx` (root layout), `src/app/[locale]/page.tsx` (home route)
- **React Compiler**: enabled via `reactCompiler: true` in `next.config.ts` — do not manually memoize with `useMemo`/`useCallback` unless the compiler cannot handle a case
- **Styling**: CSS Modules (`*.module.css`) co-located with components; global styles in `src/app/globals.css`

## Localisation (next-intl v4)

- **Locales**: `sl` (Slovene, default) and `en` (English)
- **URL strategy**: `localePrefixMode: 'as-needed'` — Slovene has no prefix (`/`), English is at `/en`
- **Routing config**: `src/i18n/routing.ts` — single source of truth for locales/defaultLocale
- **Request config**: `src/i18n/request.ts` — passed to the next-intl plugin in `next.config.ts`
- **Navigation helpers**: `src/i18n/navigation.ts` — use `Link`, `useRouter`, `usePathname` from here instead of `next/navigation`
- **Proxy**: `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) — wraps `createMiddleware` from `next-intl/middleware`
- **Translation files**: `messages/sl.json` and `messages/en.json`
- **Adding a new translated string**: add to both JSON files under the same key, then use `useTranslations('Namespace')` in a Server Component or `getTranslations('Namespace')` in an async Server Component/route handler
- **Static rendering**: call `setRequestLocale(locale)` at the top of every `[locale]` layout and page that uses `generateStaticParams`

## Next.js 16 breaking changes to be aware of

- **`next lint` removed** — use `eslint` (or `npx eslint`) directly; `next build` no longer runs linting
- **`serverRuntimeConfig` / `publicRuntimeConfig` removed** — use `process.env` in Server Components and `NEXT_PUBLIC_` prefix for client-accessible env vars
- **AMP removed** — `next/amp` and `useAmp` no longer exist
- **Parallel routes** — all `@slot` folders require an explicit `default.js`/`default.tsx` file or the build will fail
- **ESLint Flat Config** — `eslint.config.mjs` is already set up correctly; do not add a legacy `.eslintrc` file
- **Scroll behavior** — Next.js no longer overrides `scroll-behavior` on the `<html>` element; add `data-scroll-behavior="smooth"` if needed
- **Slow navigations** — if fixing slow client-side navigations, `Suspense` alone is not enough; also export `unstable_instant` from the route (see `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.mdx`)
- Prefer server-side rendering over client-side rendering
- Avoid using `useEffect` for side effects that can be handled by server-side rendering
- Avoid using `useLayoutEffect` for side effects that can be handled by server-side rendering

## General Guidelines
- Instead of 'React.method' import 'React' and use 'method' directly.
- Always annotate types, use null when something can be null (in hooks, states, etc.).
