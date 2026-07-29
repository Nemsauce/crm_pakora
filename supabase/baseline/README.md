# Audited CRM schema baseline

This directory versions the schema-only baseline required by CRM Pakora v4.
It is not a normal production migration: production already owns this schema,
and applying the baseline there would fail its empty-target preflight.

## Provenance

- Source project: production ref `nauqpgsspwfqkxidenkx`.
- Extraction date: `2026-07-28`.
- Extraction method: read-only `pg_catalog` and `information_schema` queries
  through the Supabase Management API.
- Target used for verification: `CRM staging`, ref
  `qmpcthkbrckjeedbxgkw`.
- Business rows copied from production: **zero**.

`20260728_crm_public_schema.sql` recreates the current public schema inside one
transaction and rejects a target that already contains any CRM table or enum.
The staging marker is deliberately separate under `supabase/staging/`; it must
never be promoted to production by a migration workflow.

## Verified parity

The source and target returned identical canonical fingerprints for:

| Surface | Count |
| --- | ---: |
| Tables | 21 |
| Columns | 221 |
| Enum types / values | 9 / 52 |
| Constraints | 47 |
| Functions | 14 |
| Non-constraint indexes | 30 |
| RLS policies | 34 |
| Tables with RLS | 21 |
| Application triggers | 8 |
| Realtime publications | 1 |

The fingerprint query excludes only `public.e2e_environment_guard`, because
that table is intentionally staging-only. Function definitions, owners,
security flags, volatility, config and ACLs are included in the comparison.

## Integrity

- `20260728_crm_public_schema.sql`:
  `048fa797b4e63bd8d060629af590f9313d29e6f1863fde1f43999174910e0971`
- `catalog_fingerprint.sql`:
  `4bbd1dc0b3e2c2b043a2e5cedecc75e404b3cf1ec22170d417e8a0dac3674b05`
- `../staging/20260728_crm_v4_e2e_guard.sql`:
  `09dd6a1b7ab8e562b5b1ece0a898c4925c9e0cfa34355695776e63edadea472f`

Recalculate these hashes whenever one of the SQL files changes and document
why. A changed baseline requires a fresh source/target catalog comparison; it
must not be accepted by merely updating the hash.

## Safe application procedure

1. Create a fresh temporary Supabase work directory.
2. Link it to the exact staging ref `qmpcthkbrckjeedbxgkw`.
3. Query the linked ref and confirm that the public CRM surface is empty.
4. Run `20260728_crm_public_schema.sql` through `supabase db query --linked`.
5. Regenerate application types before installing the staging-only marker.
6. Run `supabase/staging/20260728_crm_v4_e2e_guard.sql`.
7. Compare production and staging with `catalog_fingerprint.sql`.
8. Verify the marker using service-role and confirm anon cannot read it.

Never reuse the repository's production-linked Supabase work directory for a
staging write. Never run these steps with production data or credentials in
test fixtures.
