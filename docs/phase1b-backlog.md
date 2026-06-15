# Phase 1B — Hardening Backlog

Tracked from the Phase 1A review (commit `108be08`). None blocked 1A; fold these
into the 1B work (conservative auto-apply for high-confidence rejections).

1. **Durable retry cooldown + quarantine for classification failures.** Today a
   reply whose classification fails just skips and is retried every run (no
   quarantine), so a persistently-failing message can occupy a per-run slot
   indefinitely. Mirror `ingest-email-jobs`' `email_ingest_retries` pattern
   (cooldown + quarantine-after-N) for `ingest-application-replies`. Most
   important to land before 1B auto-apply, so a poison rejection can't thrash.

2. **Preserve thread correlation after a job becomes terminal.** Thread
   auto-correlation reuses a prior linked reply only if that job is still in the
   applied-stage candidate set (`Applying/Applied/Interview/Offer/Negotiating`).
   If the job moved to `Accepted`/`Rejected`, a later same-thread reply silently
   falls back to domain/company. Let thread matches resolve against all of the
   user's jobs, not just the active-stage subset.

3. **Decide whether `To Review`/`Bookmarked` are correlation candidates.** The
   candidate set is applied-stage only, so a reply for a job applied to
   externally but left in an earlier status won't auto-match (→ `unmatched` →
   manual link). Confirm this is desired, or widen the set.

4. **Correct the cosmetic `unmatched` summary calc.** In
   `ingest-application-replies`, `unmatched = recorded + unchanged - matched`
   where `matched` is counted pre-insert, so it reflects correlation *intent*
   across processed replies rather than a distinct-row count. Log-only; fix for
   accuracy.
