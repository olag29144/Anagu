## ⚠️ Before running any migration — Enable PostGIS

Migration 001 requires PostGIS. Supabase does not allow `CREATE EXTENSION` via the SQL
editor, so you must enable it through the Dashboard first:

1. Open your Supabase project → **Database** → **Extensions**
2. Search for **postgis**
3. Click **Enable** and wait for it to show as enabled
4. Then proceed with migration 001 in the SQL editor

Do not run migration 001 until PostGIS is listed as enabled.

---

# Database Migrations

This directory contains SQL migration files for the Anagu Land Administration Framework.
They must be applied in numerical order to a Supabase project that has PostGIS enabled.

All migrations are **idempotent** — safe to run more than once without causing errors or
duplicate objects.

## Migration order

| File | Depends on | Creates |
|------|-----------|---------|
| `../spatial/migrations/001_spatial_schema.sql` | — (run **first**) | `parcels` table, PostGIS extension, `check_geometry_valid` and `check_parcel_overlap` RPC functions |
| `002_audit_trail.sql` | — | `audit_trail` table with RLS policies |
| `003_applications.sql` | **001** | `applications` table (incl. `parcel_ring JSONB`); adds FK from `parcels.application_id` |
| `004_land_titles.sql` | 001, 003 | `land_titles` table |
| `005_mqtt_events.sql` | — | `mqtt_events` monitoring table |
| `006_user_roles.sql` | — | `user_roles` table |

> **Important:** `001_spatial_schema.sql` must be applied before `003_applications.sql`.
> Migration 003 adds a foreign key constraint from `parcels.application_id` to
> `applications.id`, so the `parcels` table must already exist.

## Notable columns

- `applications.parcel_ring` (`JSONB`) — stores the raw GeoJSON ring coordinates for the
  parcel boundary, as consumed by `registration-pipeline.service.ts`.

## Applying migrations via the Supabase SQL editor

1. Open your Supabase project dashboard at <https://app.supabase.com>.
2. Navigate to **Database → SQL editor**.
3. Paste the contents of each file into a new query tab, in the order listed above.
4. Click **Run** for each file. Verify the output shows no errors before continuing.

## Applying migrations via the Supabase CLI

```bash
# Install the CLI (once)
npm install -g supabase

# Link to your project (once, from the repo root)
supabase login
supabase link --project-ref <your-project-ref>

# Push a single migration file
supabase db push --db-url "$SUPABASE_DB_URL" < path/to/migration.sql

# Or use supabase db push if you migrate to the supabase/migrations directory layout
```

> **Note:** `SUPABASE_DB_URL` is the direct PostgreSQL connection string found in
> **Settings → Database → Connection string (URI)** in your Supabase dashboard.

## Environment variables

All application code reads credentials from the `.env` file at the repo root. Never
hardcode Supabase credentials in source files. See `.env.example` for the full list of
required variables.

## Row-Level Security (RLS)

The `audit_trail` table has RLS enabled with the following policies:
- `INSERT` — allowed for the `service_role` key only (used by the NestJS backend).
- `UPDATE` — denied for all roles (audit records are immutable).
- `DELETE` — denied for all roles (audit records are immutable).
- `SELECT` — allowed for authenticated users.

These policies are defined in `002_audit_trail.sql` and are created idempotently via a
`DO $$` block, so re-running the migration will not produce duplicate-policy errors.
