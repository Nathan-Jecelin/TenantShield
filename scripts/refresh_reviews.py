#!/usr/bin/env python3
"""
TenantShield Review Refresher — Weekly Re-scrape
Handles two categories:
  - Retry:   Buildings with relevant_review_count=0 AND processed_at > 7 days ago
  - Refresh: Buildings with relevant_review_count>0 AND processed_at > 30 days ago

Usage:
  # Sunday 2 AM — retry empties + refresh stale
  source .env.local && python scripts/refresh_reviews.py --max-batches 100

  # Retry empties only (Reddit-only, cheaper)
  source .env.local && python scripts/refresh_reviews.py --retry-only --skip-google

  # Refresh stale only (full pipeline)
  source .env.local && python scripts/refresh_reviews.py --refresh-only
"""

import argparse
import io
import json
import os
import sys
import time
from datetime import datetime, timezone

# Force UTF-8 output on Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import requests

# ── Paths ─────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROGRESS_PATH = os.path.join(SCRIPT_DIR, "refresh.progress.json")
LOG_DIR = os.path.join(SCRIPT_DIR, "logs")

# ── Helpers ───────────────────────────────────────────────────────────────


def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def fmt_duration(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}h {m}m {s}s"
    return f"{m}m {s}s"


# ── Supabase queries ─────────────────────────────────────────────────────


def get_retry_candidates(supabase_url: str, supabase_key: str, min_age_days: int = 7) -> list[dict]:
    """Buildings with 0 relevant reviews, processed > min_age_days ago."""
    return _query_candidates(supabase_url, supabase_key, min_age_days, "eq.0")


def get_refresh_candidates(supabase_url: str, supabase_key: str, min_age_days: int = 30) -> list[dict]:
    """Buildings with >0 relevant reviews, processed > min_age_days ago."""
    return _query_candidates(supabase_url, supabase_key, min_age_days, "gt.0")


def _query_candidates(supabase_url: str, supabase_key: str, min_age_days: int, review_count_filter: str) -> list[dict]:
    """Query Supabase for refresh/retry candidates."""
    if not supabase_url or not supabase_key:
        log("ERROR: Supabase credentials not set")
        return []

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }
    base_url = f"{supabase_url}/rest/v1/community_reviews"

    cutoff = datetime.now(timezone.utc).isoformat()
    # We'll filter by age client-side since Supabase REST date math is limited

    candidates = []
    offset = 0
    page_size = 1000

    while True:
        try:
            r = requests.get(
                base_url,
                headers=headers,
                params={
                    "select": "address,relevant_review_count,processed_at",
                    "relevant_review_count": review_count_filter,
                    "limit": page_size,
                    "offset": offset,
                    "order": "processed_at.asc",
                },
                timeout=30,
            )
            if r.status_code != 200:
                log(f"  Supabase query failed ({r.status_code}): {r.text[:200]}")
                break
            rows = r.json()
        except Exception as e:
            log(f"  Supabase query error: {e}")
            break

        if not rows:
            break

        now = datetime.now(timezone.utc)
        for row in rows:
            processed_at = row.get("processed_at", "")
            if not processed_at:
                candidates.append(row)
                continue
            try:
                proc_dt = datetime.fromisoformat(processed_at.replace("Z", "+00:00"))
                age_days = (now - proc_dt).days
                if age_days >= min_age_days:
                    candidates.append(row)
            except (ValueError, TypeError):
                candidates.append(row)

        if len(rows) < page_size:
            break
        offset += page_size

    return candidates


# ── Progress tracking ─────────────────────────────────────────────────────


def load_progress() -> dict:
    if os.path.exists(PROGRESS_PATH):
        with open(PROGRESS_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {"last_completed_index": 0, "mode": "", "stats": {}}


def save_progress(index: int, mode: str, stats: dict) -> None:
    data = {
        "last_completed_index": index,
        "mode": mode,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "stats": stats,
    }
    with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ── Main ──────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="TenantShield Review Refresher — retry empties and refresh stale reviews"
    )
    parser.add_argument("--retry-only", action="store_true", help="Only retry buildings with 0 reviews")
    parser.add_argument("--refresh-only", action="store_true", help="Only refresh buildings with existing reviews")
    parser.add_argument("--batch-size", type=int, default=50, help="Buildings per batch (default 50)")
    parser.add_argument("--pause", type=int, default=30, help="Seconds between batches (default 30)")
    parser.add_argument("--max-batches", type=int, default=0, help="Stop after N batches (0 = unlimited)")
    parser.add_argument("--skip-google", action="store_true", help="Reddit-only mode")
    parser.add_argument("--retry-age", type=int, default=7, help="Min days since last scrape for retry (default 7)")
    parser.add_argument("--refresh-age", type=int, default=30, help="Min days since last scrape for refresh (default 30)")
    parser.add_argument("--fresh", action="store_true", help="Ignore progress file, start from beginning")
    args = parser.parse_args()

    # Import scrape_reviews and load env
    sys.path.insert(0, SCRIPT_DIR)
    import scrape_reviews as sr

    sr.load_env(os.path.join(os.path.dirname(SCRIPT_DIR), ".env.local"))

    if not sr.ANTHROPIC_KEY:
        log("WARNING: ANTHROPIC_API_KEY not set. Claude analysis will be skipped.")
    if args.skip_google:
        sr.GOOGLE_PLACES_KEY = ""
        log("Google Places disabled (--skip-google)")

    os.makedirs(LOG_DIR, exist_ok=True)

    # Build candidate list
    candidates = []

    if not args.refresh_only:
        retry = get_retry_candidates(sr.SUPABASE_URL, sr.SUPABASE_SERVICE_KEY, args.retry_age)
        log(f"Retry candidates (0 reviews, >{args.retry_age}d old): {len(retry)}")
        for row in retry:
            candidates.append({"address": row["address"], "mode": "retry"})

    if not args.retry_only:
        refresh = get_refresh_candidates(sr.SUPABASE_URL, sr.SUPABASE_SERVICE_KEY, args.refresh_age)
        log(f"Refresh candidates (>0 reviews, >{args.refresh_age}d old): {len(refresh)}")
        for row in refresh:
            candidates.append({"address": row["address"], "mode": "refresh"})

    if not candidates:
        log("No candidates to process. Done.")
        return

    log(f"Total candidates: {len(candidates)}")

    # Load progress for resume
    progress = load_progress()
    start_idx = progress["last_completed_index"] if not args.fresh else 0
    cumulative_stats = progress.get("stats", {
        "processed": 0, "errors": 0, "with_reviews": 0, "no_mentions": 0,
    })

    candidates = candidates[start_idx:]

    # Batch processing loop
    batch_num = 0
    idx = 0

    while idx < len(candidates):
        if args.max_batches and batch_num >= args.max_batches:
            log(f"\nReached max batches ({args.max_batches}). Stopping.")
            break

        batch_end = min(idx + args.batch_size, len(candidates))
        batch = candidates[idx:batch_end]
        batch_num += 1
        batch_start_time = time.time()

        batch_processed = 0
        batch_errors = 0
        batch_with_reviews = 0
        batch_no_mentions = 0

        log(f"\n{'='*60}")
        log(f"Batch {batch_num} — processing {len(batch)} addresses")
        log(f"{'='*60}")

        for item in batch:
            address = item["address"]
            mode = item["mode"]

            try:
                if mode == "retry":
                    # Retry: quick check first, then full if mentions found
                    has_mentions = sr.quick_reddit_check(address)
                    if not has_mentions:
                        sr.upload_empty_record(address)
                        batch_no_mentions += 1
                        batch_processed += 1
                        log(f"  [{address}] retry — still no mentions")
                        continue

                    log(f"  [{address}] retry — mentions found! Running full scrape")
                    result = sr.process_building(address, "", "")
                    sr.upload_to_supabase(result)
                    batch_processed += 1
                    if result.get("relevant_review_count", 0) > 0:
                        batch_with_reviews += 1
                    else:
                        batch_no_mentions += 1

                else:
                    # Refresh: full pipeline to catch new reviews
                    log(f"  [{address}] refresh — running full scrape")
                    result = sr.process_building(address, "", "")
                    sr.upload_to_supabase(result)
                    batch_processed += 1
                    if result.get("relevant_review_count", 0) > 0:
                        batch_with_reviews += 1
                    else:
                        batch_no_mentions += 1

            except KeyboardInterrupt:
                log("\nInterrupted by user. Saving progress...")
                save_progress(start_idx + idx, "mixed", cumulative_stats)
                sys.exit(0)
            except Exception as e:
                log(f"  [{address}] ERROR: {e}")
                batch_errors += 1

        # Update cumulative stats
        cumulative_stats["processed"] = cumulative_stats.get("processed", 0) + batch_processed
        cumulative_stats["errors"] = cumulative_stats.get("errors", 0) + batch_errors
        cumulative_stats["with_reviews"] = cumulative_stats.get("with_reviews", 0) + batch_with_reviews
        cumulative_stats["no_mentions"] = cumulative_stats.get("no_mentions", 0) + batch_no_mentions

        completed_idx = start_idx + batch_end
        save_progress(completed_idx, "mixed", cumulative_stats)

        # Batch summary
        batch_elapsed = time.time() - batch_start_time
        total_candidates = len(candidates) + start_idx
        pct = (completed_idx / total_candidates * 100) if total_candidates else 0

        log(f"\n{'═'*50}")
        log(f"Batch {batch_num} complete")
        log(f"  Processed: {batch_processed} | Errors: {batch_errors}")
        log(f"  With reviews: {batch_with_reviews} | No mentions: {batch_no_mentions}")
        log(f"  Total progress: {completed_idx:,} / {total_candidates:,} ({pct:.1f}%)")
        log(f"  Elapsed this batch: {fmt_duration(batch_elapsed)}")
        log(f"{'═'*50}")

        idx = batch_end

        # Pause between batches
        if idx < len(candidates) and (not args.max_batches or batch_num < args.max_batches):
            log(f"Pausing {args.pause}s before next batch...")
            try:
                time.sleep(args.pause)
            except KeyboardInterrupt:
                log("\nInterrupted during pause. Progress saved.")
                sys.exit(0)

    # Final summary
    log(f"\n{'='*60}")
    log(f"Refresh session complete — {batch_num} batches processed")
    log(f"  Total processed: {cumulative_stats.get('processed', 0):,}")
    log(f"  Total errors: {cumulative_stats.get('errors', 0):,}")
    log(f"  With reviews: {cumulative_stats.get('with_reviews', 0):,}")
    log(f"  No mentions: {cumulative_stats.get('no_mentions', 0):,}")
    log(f"{'='*60}")

    # Clean up progress file on full completion
    if idx >= len(candidates) and (not args.max_batches or batch_num < args.max_batches):
        if os.path.exists(PROGRESS_PATH):
            os.remove(PROGRESS_PATH)
            log("Progress file cleaned up (all candidates processed)")


if __name__ == "__main__":
    main()
