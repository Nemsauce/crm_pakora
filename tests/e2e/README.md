# CRM v4 E2E harness

The default suite is deliberately read-only and local-only. It starts Next.js
with every Supabase credential blanked, blocks browser requests to the
versioned production origins, intercepts WebSockets before any disallowed
server connection, and covers the public auth shell, dual-theme
rendering, responsive viewports, reduced motion and pure fixture/schema
contracts. It never loads the authenticated or mutable Playwright projects.

`pnpm test:e2e:a11y:baseline` characterizes the current accessibility baseline.
It is intentionally not named `strict`: G0 records one existing light-theme
login error contrast violation, and G3 must remove that explicit debt.

Mutable journeys remain disabled until a separate Supabase project has an
audited schema baseline, staging-only Auth users and deterministic fixtures.
They run only against the remote attested Vercel Preview; localhost targets are
rejected in mutable mode.

Before any mutable test or seed, run:

```bash
pnpm test:e2e:guard
```

The command fails unless the application and Supabase origins match the exact
staging identifiers, the Supabase ref is in the versioned positive allowlist,
neither origin matches the production denylist, `VERCEL_ENV=preview`, mutations
are explicitly enabled and a staging-only database marker is found through a
read-only query. The versioned allowlist contains only the audited
`CRM staging` ref `qmpcthkbrckjeedbxgkw`; every other non-production project
still fails closed.

The preview must also attest its own server-side configuration through
`/api/e2e/attestation`, protected by `E2E_ATTESTATION_TOKEN`. The runner checks
the response origin, Vercel environment, project ref and marker against its own
verified values. This prevents a correctly configured runner from testing a
preview that was accidentally deployed with production Supabase variables.

The mutable harness additionally requires the runner-only
`E2E_VERCEL_AUTOMATION_BYPASS_SECRET`, copied from Vercel's 32-character
Protection Bypass for Automation capability. The runner sends it only as the
`x-vercel-protection-bypass` header: once on the exact attestation request and
on browser HTTP requests whose origin exactly matches the attested Preview.
It is never placed in a URL, returned by the guard, persisted as a bypass
cookie, or forwarded to Supabase. Do not replace this scoped injection with a
global Playwright `extraHTTPHeaders` setting: the CRM calls Supabase directly
from the browser, so a global header would disclose the Vercel capability to a
different origin.

The current browser WebSocket contract permits only the attested Supabase host
for Realtime. App-origin WebSockets remain closed because Playwright's routed
WebSocket connection cannot safely inject an origin-scoped handshake header.
If the CRM later adds an app-origin WebSocket, its Vercel cookie bootstrap and
artifact handling must be reviewed as a separate contract before allowlisting
that host.

Once G0 staging is provisioned, the authenticated smoke is invoked with:

```bash
pnpm test:e2e:mutable
```

Setting `E2E_RUN_MUTABLE=true` adds a mandatory Playwright dependency chain:
`staging-guard` (including the database marker) → `auth` → `mutable`. Missing
credentials or a failed guard stop authentication before any mutable test can
run. A conditional global setup performs the full marker and deployment
attestation even when Playwright is invoked with `--no-deps`. Required
variables are documented in `.env.example`; secrets belong only in local/CI
secret stores and never in Git.

Deployment attestation keeps `redirect: "error"` and validates the exact
response URL and origin. A missing or rejected Vercel bypass, an authentication
redirect, or any identity drift therefore fails before browser authentication
or mutable work begins.

`schema-readiness.mjs` audits literal `.from("...")` and `.rpc("...")` calls in
tracked application sources against the generated Supabase types without
connecting to a database. Within that explicit detection scope it now requires
zero table, RPC or observed-column gaps and fails on new drift. Dynamic names
and query wrappers are outside the scanner's proof; the audited schema baseline
and catalog fingerprint remain the broader structural evidence.

The logical fixture contract is deterministic and deeply immutable. Its
scenario-oracle helpers validate manifest consistency; they do not claim to
execute private UI formulas or database RPCs. Current production parity is
tested only where pure exports exist: Dropi history counts, task result options
and WhatsApp phone formatting. Its database adapter stays blocked until the
staging Auth users and physical deterministic fixtures are provisioned. Schema,
regenerated types, RLS and the staging-only marker are already verified.

The attestation contract has direct branch tests for `404`, `401`, `503`,
`409` and `200`, plus a real local HTTP smoke proving the route returns `404`
and `Cache-Control: no-store` outside Preview. The live Preview path remains
gated until its variables and Vercel automation bypass are configured; the
isolated Supabase schema and marker already exist.

Visual baselines are generated intentionally and reviewed in Git. Never update
snapshots merely to make an unexplained difference pass.
