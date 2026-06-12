# Agent Instructions — jobsearch repo

## GitHub identity: this repo pushes as `ekazee01-lgtm`

This machine has TWO GitHub identities. Pushing with the wrong one fails with
read-only/permission errors:

| Identity | Used for | Access to this repo |
|---|---|---|
| `ekazee01-lgtm` | This repo (jobsearch) | Write (owner) |
| `AlphaStake1` | Alpha Stake projects | Read-only |

Credential stores are SEPARATE per environment:
- **Windows**: Git Credential Manager already holds `ekazee01-lgtm`. Pushes
  from PowerShell/Windows git just work — no setup needed.
- **WSL**: has its own gh/git credentials. The default `gh` session is
  `AlphaStake1`, which CANNOT push here.

### Before any push (WSL)

```bash
# 1. Check which account is active
gh auth status

# 2. If ekazee01-lgtm is not the active account for github.com:
gh auth switch --hostname github.com --user ekazee01-lgtm
#    (If ekazee01-lgtm was never logged in on WSL, run `gh auth login`
#     once and authenticate as ekazee01-lgtm — both accounts can stay
#     logged in side by side; `switch` toggles between them.)

# 3. Make sure git uses gh for HTTPS credentials
gh auth setup-git

# 4. Verify identity and write access BEFORE pushing
gh api user --jq .login                # must print: ekazee01-lgtm
gh repo view ekazee01-lgtm/jobsearch --json viewerPermission
#                                      # must be WRITE or ADMIN

# 5. Push
git push origin main
```

If `gh auth switch` is unavailable (old gh) or fails, do NOT retry with the
AlphaStake1 identity and do NOT grant it access — either fall back to pushing
from the Windows side, or point WSL git at the Windows credential manager:

```bash
git config --global credential.helper \
  "/mnt/c/Program\\ Files/Git/mingw64/bin/git-credential-manager.exe"
```

### Commit author identity

Commits in this repo should be authored as the job-search identity regardless
of environment. Set it per-repo (never `--global`, to avoid leaking into
Alpha Stake repos):

```bash
git config user.name  "ekazee01-lgtm"
git config user.email "ekazee01@gmail.com"
```

### General rules

- Never push Alpha Stake work to this repo or vice versa. If `git remote -v`
  does not show `ekazee01-lgtm/jobsearch`, stop and ask.
- This is a PUBLIC repo: never commit credentials, API keys, OAuth secrets,
  or `.env*` files with real values. GitHub Push Protection is active and
  will reject such pushes; if it triggers, scrub history — do not click
  "allow secret" links.
- Supabase project for this repo: `hndkhpwzvybbiagnjkdr`. See AUTOMATION.md
  for the automation runbook.
