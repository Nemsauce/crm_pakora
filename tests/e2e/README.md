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
read-only query. The allowlist is deliberately empty until the real staging
schema has been audited, so mutable execution currently fails closed.

The preview must also attest its own server-side configuration through
`/api/e2e/attestation`, protected by `E2E_ATTESTATION_TOKEN`. The runner checks
the response origin, Vercel environment, project ref and marker against its own
verified values. This prevents a correctly configured runner from testing a
preview that was accidentally deployed with production Supabase variables.

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

`schema-readiness.mjs` audits literal `.from("...")` and `.rpc("...")` calls in
tracked application sources against the generated Supabase types without
connecting to a database. Within that explicit detection scope it records the
exact known type debt and fails on any new unallowlisted table/RPC gap. Dynamic
names and query wrappers are outside the scanner's proof; the audited schema
dump and regenerated types remain mandatory before enabling staging writes.

The logical fixture contract is deterministic and deeply immutable. Its
scenario-oracle helpers validate manifest consistency; they do not claim to
execute private UI formulas or database RPCs. Current production parity is
tested only where pure exports exist: Dropi history counts, task result options
and WhatsApp phone formatting. Its database adapter stays blocked until the
schema dump, regenerated types, Auth users, RLS and staging marker are all
verified.

The attestation contract has direct branch tests for `404`, `401`, `503`,
`409` and `200`, plus a real local HTTP smoke proving the route returns `404`
and `Cache-Control: no-store` outside Preview. The live Preview/marker path is
still blocked until the isolated staging deployment exists.

Visual baselines are generated intentionally and reviewed in Git. Never update
snapshots merely to make an unexplained difference pass.
