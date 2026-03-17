#!/usr/bin/env python3
"""
TenantShield Full-City Scraper — Batch Orchestrator
Scrapes all ~173K addresses from Chicago Building Violations database.

Usage:
  # Overnight run (200 batches ≈ 10K buildings, ~23 hours)
  source .env.local && python scripts/scrape_all_buildings.py --max-batches 200 --skip-google

  # Resume next night — picks up where it left off
  source .env.local && python scripts/scrape_all_buildings.py --max-batches 200 --skip-google

  # Dry run to verify manifest + skip logic
  python scripts/scrape_all_buildings.py --dry-run
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
MANIFEST_PATH = os.path.join(SCRIPT_DIR, "address_manifest.json")
PROGRESS_PATH = os.path.join(SCRIPT_DIR, "scrape_all.progress.json")
LOG_DIR = os.path.join(SCRIPT_DIR, "logs")

# ── Chicago Violations API ────────────────────────────────────────────────

VIOLATIONS_API = "https://data.cityofchicago.org/resource/6br9-quuz.json"
PAGE_SIZE = 50000

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


# ── Manifest: fetch all addresses from violations API ─────────────────────


def fetch_address_manifest(fresh: bool = False) -> list[dict]:
    """Fetch all unique addresses with violation counts from Chicago
    Violations API, paginated in 50K chunks. Caches to disk."""
    if not fresh and os.path.exists(MANIFEST_PATH):
        log(f"Loading cached manifest from {MANIFEST_PATH}")
        with open(MANIFEST_PATH, encoding="utf-8") as f:
            data = json.load(f)
        log(f"  {len(data['addresses'])} addresses loaded")
        return data["addresses"]

    log("Fetching address manifest from Chicago Violations API...")
    all_addresses = []
    offset = 0

    while True:
        params = {
            "$select": "address, count(*) as violation_count",
            "$group": "address",
            "$order": "violation_count DESC",
            "$limit": PAGE_SIZE,
            "$offset": offset,
        }
        log(f"  Fetching offset {offset}...")
        try:
            r = requests.get(VIOLATIONS_API, params=params, timeout=60)
            r.raise_for_status()
            page = r.json()
        except Exception as e:
            log(f"  ERROR fetching manifest page at offset {offset}: {e}")
            break

        if not page:
            break

        for row in page:
            addr = row.get("address", "").strip()
            count = int(row.get("violation_count", 0))
            if addr:
                all_addresses.append({"address": addr, "violation_count": count})

        log(f"  Got {len(page)} rows (total so far: {len(all_addresses)})")

        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(1)

    # Cache to disk
    manifest = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "total_addresses": len(all_addresses),
        "addresses": all_addresses,
    }
    os.makedirs(os.path.dirname(MANIFEST_PATH) or ".", exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    log(f"Manifest saved: {len(all_addresses)} addresses -> {MANIFEST_PATH}")

    return all_addresses


# ── Supabase: get already-scraped addresses ───────────────────────────────


def get_scraped_addresses(supabase_url: str, supabase_key: str) -> dict[str, str]:
    """Query Supabase community_reviews for all already-scraped addresses.
    Returns dict of {ADDRESS_UPPER: processed_at_iso}."""
    if not supabase_url or not supabase_key:
        return {}

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }
    base_url = f"{supabase_url}/rest/v1/community_reviews"

    scraped = {}
    offset = 0
    page_size = 1000

    log("Querying Supabase for already-scraped addresses...")
    while True:
        try:
            r = requests.get(
                base_url,
                headers=headers,
                params={
                    "select": "address,processed_at",
                    "limit": page_size,
                    "offset": offset,
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

        for row in rows:
            addr = (row.get("address") or "").upper()
            if addr:
                scraped[addr] = row.get("processed_at", "")

        if len(rows) < page_size:
            break
        offset += page_size

    log(f"  {len(scraped)} addresses already scraped in Supabase")
    return scraped


# ── Progress tracking ─────────────────────────────────────────────────────


def load_progress() -> dict:
    if os.path.exists(PROGRESS_PATH):
        with open(PROGRESS_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {"last_completed_rank": 0, "stats": {}}


def save_progress(rank: int, stats: dict) -> None:
    data = {
        "last_completed_rank": rank,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "stats": stats,
    }
    with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ── Main orchestrator ─────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="TenantShield Full-City Scraper — batch process all Chicago buildings"
    )
    parser.add_argument("--fresh", action="store_true", help="Re-fetch address manifest, ignore progress")
    parser.add_argument("--batch-size", type=int, default=50, help="Buildings per batch (default 50)")
    parser.add_argument("--pause", type=int, default=30, help="Seconds between batches (default 30)")
    parser.add_argument("--max-batches", type=int, default=0, help="Stop after N batches (0 = unlimited)")
    parser.add_argument("--skip-google", action="store_true", help="Reddit-only mode (saves Google API costs)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed, don't scrape")
    parser.add_argument("--stale-days", type=int, default=0, help="Re-scrape addresses older than N days (0 = skip all scraped)")
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

    # Ensure log dir exists
    os.makedirs(LOG_DIR, exist_ok=True)

    # 1. Fetch address manifest
    addresses = fetch_address_manifest(fresh=args.fresh)
    total = len(addresses)
    log(f"Total addresses in manifest: {total:,}")

    # 2. Get already-scraped from Supabase
    scraped = get_scraped_addresses(sr.SUPABASE_URL, sr.SUPABASE_SERVICE_KEY)

    # 3. Load progress (rank-based resume)
    progress = load_progress()
    start_rank = progress["last_completed_rank"] if not args.fresh else 0
    cumulative_stats = progress.get("stats", {
        "processed": 0, "skipped": 0, "errors": 0,
        "with_reviews": 0, "no_mentions": 0,
    })

    # 4. Filter: determine which addresses to process
    to_process = []
    for rank, entry in enumerate(addresses):
        if rank < start_rank:
            continue
        addr_upper = entry["address"].upper()
        if addr_upper in scraped:
            if args.stale_days > 0:
                processed_at = scraped[addr_upper]
                if processed_at:
                    try:
                        proc_dt = datetime.fromisoformat(processed_at.replace("Z", "+00:00"))
                        age_days = (datetime.now(timezone.utc) - proc_dt).days
                        if age_days < args.stale_days:
                            continue  # Not stale yet
                    except (ValueError, TypeError):
                        pass
                # Stale or unparseable — re-process
            else:
                continue  # Skip already scraped
        to_process.append((rank, entry))

    log(f"Addresses to process: {len(to_process):,} (skipping {total - len(to_process) - start_rank:,} already scraped)")

    if args.dry_run:
        log("\n=== DRY RUN ===")
        log(f"Would process {len(to_process):,} addresses")
        log(f"Starting from rank {start_rank}")
        if to_process:
            log(f"First 10:")
            for rank, entry in to_process[:10]:
                log(f"  #{rank+1}: {entry['address']} ({entry['violation_count']} violations)")
            if len(to_process) > 10:
                log(f"  ... and {len(to_process) - 10:,} more")
        batches_needed = (len(to_process) + args.batch_size - 1) // args.batch_size
        log(f"Batches needed: {batches_needed:,} (batch size {args.batch_size})")
        if args.max_batches:
            log(f"Max batches: {args.max_batches} ({min(args.max_batches * args.batch_size, len(to_process)):,} buildings)")
        return

    # 5. Batch processing loop
    batch_num = 0
    idx = 0

    while idx < len(to_process):
        if args.max_batches and batch_num >= args.max_batches:
            log(f"\nReached max batches ({args.max_batches}). Stopping.")
            break

        batch_end = min(idx + args.batch_size, len(to_process))
        batch = to_process[idx:batch_end]
        batch_num += 1
        batch_start_time = time.time()

        batch_processed = 0
        batch_skipped = 0
        batch_errors = 0
        batch_with_reviews = 0
        batch_no_mentions = 0

        log(f"\n{'='*60}")
        log(f"Batch {batch_num} — processing {len(batch)} addresses")
        log(f"{'='*60}")

        for rank, entry in batch:
            address = entry["address"]
            try:
                # Quick Reddit check first
                has_mentions = sr.quick_reddit_check(address)

                if not has_mentions:
                    # No Reddit mentions — upload empty record and move on
                    sr.upload_empty_record(address)
                    batch_no_mentions += 1
                    batch_processed += 1
                    log(f"  [{address}] No Reddit mentions — empty record saved")
                    continue

                # Has mentions — run full pipeline
                log(f"  [{address}] Reddit mentions found — running full scrape")
                result = sr.process_building(address, "", "")
                sr.upload_to_supabase(result)
                batch_processed += 1

                if result.get("relevant_review_count", 0) > 0:
                    batch_with_reviews += 1
                else:
                    batch_no_mentions += 1

            except KeyboardInterrupt:
                log("\nInterrupted by user. Saving progress...")
                save_progress(rank, cumulative_stats)
                sys.exit(0)
            except Exception as e:
                log(f"  [{address}] ERROR: {e}")
                batch_errors += 1

        # Update cumulative stats
        cumulative_stats["processed"] = cumulative_stats.get("processed", 0) + batch_processed
        cumulative_stats["skipped"] = cumulative_stats.get("skipped", 0) + batch_skipped
        cumulative_stats["errors"] = cumulative_stats.get("errors", 0) + batch_errors
        cumulative_stats["with_reviews"] = cumulative_stats.get("with_reviews", 0) + batch_with_reviews
        cumulative_stats["no_mentions"] = cumulative_stats.get("no_mentions", 0) + batch_no_mentions

        # Save progress (last rank in this batch)
        last_rank = batch[-1][0] + 1  # +1 so we skip past it on resume
        save_progress(last_rank, cumulative_stats)

        # Batch summary
        batch_elapsed = time.time() - batch_start_time
        total_done = cumulative_stats["processed"] + cumulative_stats["skipped"]
        pct = (last_rank / total * 100) if total else 0

        log(f"\n{'═'*50}")
        log(f"Batch {batch_num} complete")
        log(f"  Processed: {batch_processed} | Errors: {batch_errors}")
        log(f"  With reviews: {batch_with_reviews} | No mentions: {batch_no_mentions}")
        log(f"  Total progress: {last_rank:,} / {total:,} ({pct:.1f}%)")
        log(f"  Elapsed this batch: {fmt_duration(batch_elapsed)}")
        log(f"{'═'*50}")

        idx = batch_end

        # Pause between batches (unless this is the last one)
        if idx < len(to_process) and (not args.max_batches or batch_num < args.max_batches):
            log(f"Pausing {args.pause}s before next batch...")
            try:
                time.sleep(args.pause)
            except KeyboardInterrupt:
                log("\nInterrupted during pause. Progress saved.")
                sys.exit(0)

    # Final summary
    log(f"\n{'='*60}")
    log(f"Session complete — {batch_num} batches processed")
    log(f"  Total processed: {cumulative_stats.get('processed', 0):,}")
    log(f"  Total errors: {cumulative_stats.get('errors', 0):,}")
    log(f"  With reviews: {cumulative_stats.get('with_reviews', 0):,}")
    log(f"  No mentions: {cumulative_stats.get('no_mentions', 0):,}")
    log(f"{'='*60}")


if __name__ == "__main__":
    main()
