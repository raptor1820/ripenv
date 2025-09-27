# ripenv Web

Next.js App Router front-end that orchestrates project membership, Supabase auth, and recipients exports for the ripenv CLI.

## Features

-   Supabase magic-link authentication (client-only)
-   Project CRUD with member management
-   Browser-based keypair generation using TweetNaCl + Argon2id WASM
-   Recipients export (`recipients.export.json`) for the CLI

## Prerequisites

1. Create a Supabase project.
2. Enable email magic links in the Supabase dashboard.
3. Copy the project URL and anon key into `.env.local`:

```bash
cp .env.local.example .env.local
# edit with your Supabase values
```

## Development

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000` and sign in with a magic link.

## Supabase Schema & RLS

Run the following SQL in the Supabase SQL editor. It creates the required tables and policies. Comments indicate how to verify each policy.

```sql
-- Tables
create table if not exists public.profiles (
  id uuid primary key default auth.uid(),
  email text unique not null,
  public_key text,
  enc_private_key text,
  salt text,
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  public_key text,
  created_at timestamptz default now(),
  constraint project_members_pk primary key (project_id, email)
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;

-- Profiles: users manage their own row
create policy "profiles_select_self" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

-- Projects: owners full access; members read only
create policy "projects_owner_all" on public.projects
  for all using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "projects_member_read" on public.projects
  for select using (
    auth.uid() = owner or exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id and pm.email = auth.email()
    )
  );

-- Project members: owners manage, members can read
create policy "project_members_owner_manage" on public.project_members
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id and p.owner = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id and p.owner = auth.uid()
    )
  );

create policy "project_members_member_read" on public.project_members
  for select using (
    project_members.email = auth.email() or exists (
      select 1 from public.projects p
      where p.id = project_members.project_id and p.owner = auth.uid()
    )
  );
```

_Testing tip:_ sign in with two emails, add one as a member to the other’s project, and verify both see the project.

## Export Format

The "Export recipients" button on a project downloads a file shaped as:

```json
{
    "projectId": "<uuid>",
    "recipients": [
        { "email": "alice@example.com", "publicKey": "base64" },
        { "email": "bob@example.com", "publicKey": "base64" }
    ]
}
```

Only members with a stored `public_key` are included.

## Key Generation Flow

1. Visit `/keys` while signed in.
2. Choose a strong password (Argon2id parameters: time=2, memory=64MB, parallelism=1).
3. The app generates an X25519 key pair, encrypts the private key locally, uploads the encrypted payload to Supabase, and downloads `mykey.enc.json`.
4. Share only the **public** key with teammates via membership; never upload plaintext `.env` files.

## Production Notes

-   Configure Supabase auth email templates with ripenv branding.
-   Lock down Supabase storage (none required for MVP).
-   Add rate limits or captchas for magic link abuse if needed.
-   Rotate project manifests by re-running the CLI `encrypt` command whenever membership changes.
