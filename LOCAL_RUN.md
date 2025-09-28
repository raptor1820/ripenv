# Running ripenv Locally

This guide walks through installing dependencies, configuring Supabase, and using both the Next.js dashboard and the Python CLI.

---

## 1. Prerequisites

-   **Node.js** 18 or newer and npm
-   **Python** 3.10+ with pip (a virtual environment is recommended)
-   A Supabase project with the required tables (`profiles`, `projects`, `project_members`) and policies applied
-   Access to the Supabase anon key and URL for the frontend

Directory layout reminder:

```
ripenv/
├── cli/          # Python package for the ripenv CLI
└── web/          # Next.js dashboard
```

---

## 2. Frontend Setup (Next.js Dashboard)

1. **Install dependencies**:

    ```pwsh
    cd C:\Users\ritwi\Desktop\ripenv\web
    npm install
    ```

2. **Configure environment variables**:

    Create `web/.env.local` with:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
    ```

3. **Run the development server**:

    ```pwsh
    npm run dev
    ```

    Visit the URL printed in the console (typically http://localhost:3000).

4. **Production build (optional)**:

    ```pwsh
    npm run build
    npm run start
    ```

---

## 3. Backend Setup (Supabase)

1. Apply the SQL migrations that create the `profiles`, `projects`, and `project_members` tables and the associated RLS policies.
2. Ensure email magic link auth is enabled so users can sign in through the dashboard.
3. Each user should sign in at least once so a row appears in `profiles`.

> If you need to recreate the policies, refer to the SQL scripts previously shared in the project documentation.

---

## 4. CLI Setup (Python)

1. **Install dependencies**:

    ```pwsh
    cd C:\Users\ritwi\Desktop\ripenv\cli
    pip install -e .
    ```

    This installs the CLI in editable mode so local changes take effect immediately.

2. **Configure CLI environment variables**:

    The CLI now requires Supabase access to fetch project recipients. Set these environment variables:

    ```pwsh
    # PowerShell
    $env:RIPENV_SUPABASE_URL = "https://your-project-id.supabase.co"
    $env:RIPENV_SUPABASE_ANON_KEY = "your-anon-key"

    # Or add to your PowerShell profile for persistence
    # $PROFILE contains the path to your profile
    ```

    **Alternative**: Create a `.env` file in your CLI directory:

    ```env
    RIPENV_SUPABASE_URL=https://your-project-id.supabase.co
    RIPENV_SUPABASE_ANON_KEY=your-anon-key
    ```

3. **Run tests (optional but recommended)**:

    ```pwsh
    pytest
    ```

4. **Check the CLI is available**:

    ```pwsh
    ripenv --help
    ```

---

## 5. Typical Frontend Workflow

1. Launch the dev server (`npm run dev`).
2. Sign in via magic link.
3. Create a project on `/dashboard`.
4. Invite members (email addresses) on `/projects/<id>`.
5. Each member visits `/keys` to generate a keypair:
    - Downloads `mykey.enc.json` (encrypted private key)
    - Supabase now stores their public key

**Note**: You no longer need to export `recipients.export.json` - the CLI fetches recipients directly from Supabase!

---

## 6. Encrypting an Environment File (New Simplified Workflow)

1.  Prepare the plaintext env file, e.g., `deploy/.env.production`.
2.  Use the CLI with just the project ID to encrypt:

    ```pwsh
    cd C:\Users\ritwi\Desktop\ripenv\cli
    ripenv encrypt \`
        --env ..\deploy\.env.production \`
        --project-id <your-project-id> \`
        --out ..\deploy
    ```

    **What changed:**

    -   ✅ **No more `--recipients` file needed** - automatically fetched from Supabase
    -   ✅ **Just use `--project-id`** - much simpler!
    -   ✅ **Recipients are always up-to-date** - no need to manually export

    Optional flags:

    -   `--force` overwrites existing `.env.enc` / `ripenv.manifest.json` in the output directory.
    -   `--delete` deletes the original `.env` file after successful encryption for enhanced security.
    -   Omit `--out` to drop the files in the current directory.

    The encrypted env uses a fresh symmetric key, and the manifest stores that key encrypted for each recipient.

---

## 7. Decrypting an Environment File (New Simplified Workflow)

1.  Recipient needs their encrypted keyfile (from `/keys`) stored locally.
2.  Run the decrypt command with just the folder and project ID:

    ```pwsh
    ripenv decrypt \`
        --folder ..\deploy \`
        --project-id <your-project-id> \`
        --keyfile C:\path\to\mykey.enc.json
    ```

    **What changed:**

    -   ✅ **Just point to the folder** - no need to specify individual file paths
    -   ✅ **Auto-finds files** - automatically locates `.env.enc` and `ripenv.manifest.json` in the folder
    -   ✅ **Even simpler** - from 4 parameters down to just 3 (folder + project-id + keyfile)
    -   ✅ **Automatic access verification** - checks Supabase to ensure you have project access
    -   ✅ **Cleaner user experience** - clear feedback about which files are being used
    -   ✅ **Safe file placement** - decrypted `.env` is placed in the same folder as encrypted files but protected by .gitignore

    The CLI prompts for the password set on `/keys`, automatically detects your email from your keyfile's public key, verifies you have access to the project, unwraps the manifest entry, and writes a restored `.env` to the same folder as the encrypted files (with automatic .gitignore protection to prevent accidental commits). Use `--force` to overwrite an existing file.

3.  Source or copy the regenerated `.env` into your tooling, then delete it when finished.

---

## 8. Integration Flow Summary

-   The **Next.js app** manages projects, members, and key generation (client-side with WebCrypto).
-   **Supabase** stores public keys, encrypted private keys, and project membership and serves as the source of truth for access control.
-   The **CLI** directly queries Supabase to fetch recipients and verify access (`ripenv encrypt` / `ripenv decrypt`).
-   CI/CD can run `ripenv encrypt` with just a project ID to publish updated env manifests whenever secrets change.

---

## 9. Troubleshooting Tips

-   **Supabase connection issues**: Ensure `RIPENV_SUPABASE_URL` and `RIPENV_SUPABASE_ANON_KEY` environment variables are set correctly.
-   **"No recipients found"**: Make sure all project members have generated keypairs on `/keys` - the CLI only includes members with public keys.
-   **"Access denied"**: Verify you're a member of the project and your email matches what's stored in Supabase.
-   If `npm run build` fails, check the console output for lint or type errors.
-   For CLI issues, re-run `pip install -e .` to make sure dependencies are installed, and use `ripenv --help` to inspect available commands.
-   Make sure each invited member has a `profiles` row; if not, have them sign in once or insert manually.

---

## 10. Migration from Old CLI

If you have existing scripts using the old CLI:

**Before (old workflow):**

```pwsh
# Had to manually export recipients.json from web UI first
ripenv encrypt --env .env --recipients recipients.export.json --out ./encrypted
ripenv decrypt --enc ./encrypted/.env.enc --manifest ./encrypted/ripenv.manifest.json --email user@example.com --keyfile mykey.enc.json
```

**After (new simplified workflow):**

```pwsh
# No manual export needed - automatic from Supabase
ripenv encrypt --env .env --project-id abc123 --out ./encrypted

# With enhanced security - delete original .env after encryption
ripenv encrypt --env .env --project-id abc123 --out ./encrypted --delete

ripenv decrypt --folder ./encrypted --project-id abc123 --keyfile mykey.enc.json
```

---

You now have the full workflow to run the dashboard and CLI locally with the simplified Supabase-integrated commands!
