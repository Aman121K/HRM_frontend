# Northstar People — Web app

Next.js 16 (App Router) + React 19 web app for Northstar People: employee self-service, manager and HR workspaces,
payroll, attendance, compliance and the super admin console. All data comes from the platform API
([HRM_backend](https://github.com/Aman121K/HRM_backend)); this app has no database or API routes of its own.

## Repositories

Northstar People is split into four repositories:

| Repository | What it is |
|---|---|
| [HRM_backend](https://github.com/Aman121K/HRM_backend) | Platform API (NestJS + Fastify), jobs worker, PostgreSQL migrations, deploy files and runbooks |
| [HRM_frontend](https://github.com/Aman121K/HRM_frontend) | Web app (Next.js 16, React 19) |
| [HRM_Mobile_App](https://github.com/Aman121K/HRM_Mobile_App) | iOS + Android app (React Native CLI) |
| [HRM](https://github.com/Aman121K/HRM) | Marketing website |

## Run locally

```bash
npm install
cp .env.example .env.local      # NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:4100, NEXT_PUBLIC_APP_DOMAIN=localhost
npm run dev                     # http://localhost:3000 (needs the platform API running)
```

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check |
| `npm run build` / `npm start` | Production build / serve |
| `docker build -f Dockerfile --target web --build-arg NEXT_PUBLIC_PLATFORM_API_URL=… --build-arg NEXT_PUBLIC_APP_DOMAIN=… .` | Standalone container image |

`NEXT_PUBLIC_*` values are compiled into the browser bundle: build one image per environment, and never set
`NEXT_PUBLIC_ALLOW_DEMO_IDENTITY=true` outside local development.

## Structure

- `src/app` — App Router pages, layouts and per-feature CSS.
- `src/components` — product screens (HR, payroll, attendance, cases, compliance, admin console…).
- `src/lib` — API client, auth (native sign-in + OIDC PKCE), brand host helpers, module registry.
- `src/proxy.ts` — per-request CSP nonce (`src/lib/csp.ts`) and brand subdomain routing.
- `public/mediapipe`, `public/models` — self-hosted face detection for selfie punches (no third-party CDN).

## Route map

- `/` — home dashboard and employee self-service
- `/my-space` — profile, employment documents, assets, benefits, and requests
- `/people` — workforce directory and organization composition
- `/time-leave` — attendance, shifts, leave, holidays, and regularization
- `/payroll` — salary, payslips, tax, and reimbursements
- `/hiring` — jobs, candidates, interviews, offers, and recruiting funnel
- `/onboarding` — new joiners, ownership, documents, and checklist stages
- `/performance` — goals, OKRs, feedback, reviews, and calibration
- `/learning` — assigned learning, catalogue, pathways, and certifications
- `/skills` — skill profile, gaps, career paths, opportunities, and mentors
- `/succession` — critical roles, readiness, coverage, talent pools, and risk
- `/compensation` — bands, budgets, recommendations, and equity signals
- `/reports` — workforce analytics, saved reports, and report catalogue
- `/expenses` — travel and expense claims, approvals, and policy limits
- `/settings` — organization, permissions, workflows, integrations, and audit

## Brand subdomains (`<brand>.<APP_DOMAIN>`)

Every brand gets its own address, like PeopleStrong's `client.peoplestrong.com`: `got-tea.people.example.com` shows only
Got Tea's sign-in page and can only use Got Tea data. The super admin console lives on the main domain only.

- Locally nothing is needed: browsers resolve `*.localhost`, so open `http://got-tea.localhost:3000/login`.
- Config: `APP_DOMAIN` (API) and `NEXT_PUBLIC_APP_DOMAIN` (web), e.g. `people.example.com`. `CORS_ORIGIN` is the main
  web origin; brand subdomains on the same scheme/port are allowed automatically.
- Routing: `src/middleware.ts` rewrites `/login` to the brand's page, blocks `/b/<other brand>`, and sends `/admin` to the
  main domain. The API (`ModuleGuard`) rejects a request whose `Origin` is a brand subdomain when the session belongs to a
  different brand or to the super admin (`BRAND_HOST_MISMATCH`). Names like `www`, `api`, `admin` are reserved
  (HRM_backend `src/platform/organizations/brand-host.ts`, mirrored in `src/lib/brand-host.ts`).

Going live:
1. DNS: `people.example.com` and `*.people.example.com` → the web server/load balancer (one wildcard record; new brands need no DNS change).
2. TLS: a wildcard certificate for `*.people.example.com` + `people.example.com` (Let's Encrypt DNS-01 challenge, or Cloudflare).
3. Proxy: forward the original `Host` header to Next.js (Nginx `server_name people.example.com *.people.example.com;
   proxy_set_header Host $host;`, or Caddy `*.people.example.com, people.example.com { tls { dns cloudflare … } reverse_proxy web:3000 }`).
4. SSO: register `https://*.people.example.com/auth/callback` if your IdP supports wildcards (the dev IdP does via
   `DEV_IDP_REDIRECTS`); otherwise register each brand's callback when the brand is created.

