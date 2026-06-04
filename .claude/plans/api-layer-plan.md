# API Layer Plan — SiteDeck PM V1

## Context
All 12 backend service modules are complete (376 tests passing). The project currently has **no HTTP framework** and **no API routes**. The `main` field in `package.json` points to `dist/index.js`, but no `src/index.ts` exists. Hosting target is Vercel.

## Goal
Bootstrap a production-ready REST API layer that exposes the existing service modules over HTTP, with Firebase Auth, role-based access control, unified error handling, and route-level test coverage.

## Scope
- **In scope:** API foundation (Express, auth middleware wiring, error handler, route structure), health check, and a representative set of routes across key modules.
- **Out of scope:** Full CRUD for all 12 modules in one pass — we will fan out module routes after the foundation is solid.

## Approach

### 1. Dependencies
Add to `package.json`:
- `express` + `@types/express` — HTTP framework
- `body-parser` — JSON parsing (Express built-in is fine, but explicit is clearer)
- `supertest` + `@types/supertest` — route testing

No stack changes. Express is the standard Node.js web framework and is compatible with Vercel serverless deployment.

### 2. Foundation Files

#### `src/index.ts`
- Bootstrap Express app
- Apply JSON body parser
- Mount health check (`GET /health`)
- Mount `/api/v1` router
- Apply global error handler (must be last)
- Export app for Vercel serverless adapter (future) and direct server start (dev)

#### `src/lib/error-handler.ts`
- `ApiError` class extending `Error` with `statusCode` and `code`
- `handleServiceError(err)` — maps known service errors to HTTP status codes:
  - `Error('... not found')` → 404
  - `Error('Missing required fields')` / validation → 400
  - `Error('Forbidden')` / auth → 403
  - `Error('Unauthorized')` → 401
  - Everything else → 500
- `errorHandlerMiddleware` — Express middleware that catches errors and returns `{ error: { code, message } }`

#### `src/middleware/express-auth.ts`
- Bridge the existing `permission.middleware.ts` (which uses generic `AuthenticatedRequest`/`MiddlewareResponse` interfaces) to Express `Request`/`Response`/`NextFunction`.
- `requireAuth` middleware — reads `Authorization: Bearer <token>`, calls `auth.service.verifyIdToken`, attaches `req.user = { uid, role }`
- `requireRole(...roles)` middleware — returns 403 if role not in allowed list
- Reuse existing `auth.service.ts` and `verifyIdToken` — no auth logic duplication

### 3. Route Structure

```
src/routes/
├── index.ts              ← aggregates all routers under /api/v1
├── health.routes.ts      ← GET /health
├── auth.routes.ts        ← POST /auth/verify (token check, role echo)
├── project.routes.ts     ← CRUD for projects + WBS items
├── schedule.routes.ts    ← activities, baselines, change requests
├── cost.routes.ts        ← budget lines, transactions, EVM
├── dashboard.routes.ts   ← GET /dashboard/:projectId/morning
├── procurement.routes.ts ← POs, deliveries, invoices, subcontracts
├── scope.routes.ts       ← scope statements, change orders
├── communications.routes.ts ← RFIs, submittals
├── risk.routes.ts        ← risk register
├── integration.routes.ts ← issues, voice memos, change log, closeout
├── owners-rep.routes.ts  ← read-only dashboard + issues + RFI status
├── resource.routes.ts    ← equipment registry, cost summaries
└── webhook.routes.ts     ← inbound webhook receivers (idempotent)
```

### 4. Route Pattern (consistent across all modules)
Every route file follows this shape:
```typescript
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import * as someService from '../services/some.service';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

router.get('/:id', requireAuth, requireRole(ROLES.PROJECT_MANAGER, ROLES.OWNER_ADMIN), asyncHandler(async (req, res) => {
  const result = await someService.getById(req.params.id);
  res.json(result);
}));

export default router;
```

#### `src/lib/async-handler.ts`
Wrapper that catches rejected promises in async route handlers and forwards them to Express error middleware. Eliminates try/catch boilerplate in every route.

### 5. Testing Strategy
- **Unit tests:** Use `supertest` against the Express app (not against individual routers). This tests the full middleware stack (auth, roles, error handling).
- **Mock Firebase Auth:** Reuse the existing `setAuthInstance` pattern from `auth.service.ts` to inject a mock `Auth` instance.
- **Mock Prisma:** Reuse the existing `setPrismaClient` pattern.
- **Test coverage targets:**
  - Auth middleware (valid token, invalid token, missing token, role gating)
  - Error handler (404, 400, 500 paths)
  - Health check
  - At least one full-stack route per module (create + get)

### 6. Build & Deploy Considerations
- `tsconfig.json` already targets CommonJS (`"module": "commonjs"`) — Express works out of the box.
- `npm run build` compiles `src/index.ts` → `dist/index.js`. No config changes needed.
- Vercel deployment will need a `vercel.json` later (pointing to `dist/index.js` as a serverless function) — but that is a deploy config, not API code. We can add it in this pass or defer.

## Rollout Order

| Step | File(s) | What |
|------|---------|------|
| 1 | `package.json` | Install express, @types/express, supertest, @types/supertest |
| 2 | `src/lib/error-handler.ts` | ApiError + errorHandlerMiddleware |
| 3 | `src/lib/async-handler.ts` | asyncHandler wrapper |
| 4 | `src/middleware/express-auth.ts` | Bridge existing auth to Express |
| 5 | `src/routes/health.routes.ts` | Health check |
| 6 | `src/routes/index.ts` | Router aggregation |
| 7 | `src/index.ts` | Express app bootstrap |
| 8 | `src/routes/health.routes.test.ts` | Supertest harness + health test |
| 9 | `src/middleware/express-auth.test.ts` | Auth middleware tests |
| 10 | `src/routes/project.routes.ts` + `.test.ts` | First full module route |
| 11 | Fan out remaining module routes | Schedule, cost, dashboard, procurement, scope, comms, risk, integration, owners-rep, resource, webhook |

## Files Created (estimated)
- 2 new lib files (`error-handler.ts`, `async-handler.ts`)
- 1 new middleware file (`express-auth.ts`)
- 1 new entry point (`index.ts`)
- 13 route files
- 13+ test files
- Updated `package.json`

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Express adds bundle size / cold-start latency on Vercel | Express is ~200KB; acceptable for V1. Can migrate to Hono later if cold starts become a problem. |
| Full route coverage is large | Foundation first, then fan out module by module. Each module route is independent. |
| Existing `permission.middleware.ts` is generic, not Express | Create `express-auth.ts` as a thin bridge. Keep the generic middleware untouched so it remains reusable. |

## Decision Needed
**None.** Express is the obvious, standard choice for a Node.js REST API. It aligns with the locked stack (TypeScript, Vercel) and requires no architectural changes.
