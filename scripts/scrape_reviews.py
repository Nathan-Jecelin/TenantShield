#!/usr/bin/env python3
"""
TenantShield Review Aggregator
Scrapes public tenant experiences from Reddit and Google Reviews for Chicago
apartment buildings, then uses Claude AI to summarize them into clean reports.

Usage:
  Single building:
    python scrape_reviews.py --address "730 S Clark St Chicago IL" --name "The Grant" --management "Planned Property Management"

  Batch from CSV:
    python scrape_reviews.py --buildings sample_buildings.csv

  Custom output:
    python scrape_reviews.py --buildings sample_buildings.csv --output my_results.json

Requires:
  ANTHROPIC_API_KEY env var
  Optional: GOOGLE_PLACES_API_KEY env var for Google Reviews
"""

import argparse
import csv
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

DISCLAIMER = (
    "Community reports are sourced from public forums and do not represent "
    "the views of TenantShield."
)

# ── Reddit config ──────────────────────────────────────────────────────────

PULLPUSH_SUBMISSIONS = "https://api.pullpush.io/reddit/search/submission/"
PULLPUSH_COMMENTS = "https://api.pullpush.io/reddit/search/comment/"

SUBREDDITS = [
    "chicago",
    "chicagoapartments",
    "AskChicago",
    "chicagohousing",
    "ChicagoSuburbs",
]

API_DELAY = 1.5  # seconds between requests

# ── Google Places config ───────────────────────────────────────────────────

GOOGLE_PLACES_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

# ── Anthropic config ───────────────────────────────────────────────────────

ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = "claude-sonnet-4-20250514"

# ── Supabase config (optional — upload when env vars present) ─────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# ── Helpers ────────────────────────────────────────────────────────────────


def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def api_get(url: str, params: dict, label: str = "") -> dict | list | None:
    """GET with retry + rate-limit delay."""
    time.sleep(API_DELAY)
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 429:
                wait = 5 * (attempt + 1)
                log(f"  Rate-limited on {label}, waiting {wait}s...")
                time.sleep(wait)
                continue
            log(f"  {label} returned {r.status_code}, skipping")
            return None
        except requests.RequestException as e:
            log(f"  {label} error: {e}")
            if attempt < 2:
                time.sleep(3)
    return None


# ── Reddit scraping ────────────────────────────────────────────────────────


def build_queries(address: str, name: str, management: str) -> list[str]:
    """Build search query variants for a building."""
    queries = []
    # Strip city/state if present for cleaner searches
    short_addr = address.split(",")[0].strip()
    for part in ["Chicago IL", "Chicago, IL", "Chicago"]:
        short_addr = short_addr.replace(part, "").strip()

    if short_addr:
        queries.append(short_addr)
    if name:
        queries.append(name)
    if management:
        queries.append(management)
    return queries


def search_reddit(queries: list[str]) -> list[dict]:
    """Search PullPush for submissions + comments matching any query."""
    seen_ids: set[str] = set()
    results: list[dict] = []

    for query in queries:
        # ── Per-subreddit searches ──
        for sub in SUBREDDITS:
            label = f"r/{sub} q={query!r}"

            # Submissions
            data = api_get(
                PULLPUSH_SUBMISSIONS,
                {"q": query, "subreddit": sub, "size": 25, "sort": "desc", "sort_type": "score"},
                label + " [posts]",
            )
            if data and isinstance(data, dict):
                for item in data.get("data", []):
                    uid = f"post_{item.get('id', '')}"
                    if uid not in seen_ids:
                        seen_ids.add(uid)
                        results.append(_normalize_submission(item))

            # Comments
            data = api_get(
                PULLPUSH_COMMENTS,
                {"q": query, "subreddit": sub, "size": 25, "sort": "desc", "sort_type": "score"},
                label + " [comments]",
            )
            if data and isinstance(data, dict):
                for item in data.get("data", []):
                    uid = f"comment_{item.get('id', '')}"
                    if uid not in seen_ids:
                        seen_ids.add(uid)
                        results.append(_normalize_comment(item))

        # ── Broad Reddit search ──
        broad_q = f"{query} Chicago apartment"
        label = f"all q={broad_q!r}"

        data = api_get(
            PULLPUSH_SUBMISSIONS,
            {"q": broad_q, "size": 15, "sort": "desc", "sort_type": "score"},
            label + " [posts]",
        )
        if data and isinstance(data, dict):
            for item in data.get("data", []):
                uid = f"post_{item.get('id', '')}"
                if uid not in seen_ids:
                    seen_ids.add(uid)
                    results.append(_normalize_submission(item))

        data = api_get(
            PULLPUSH_COMMENTS,
            {"q": broad_q, "size": 15, "sort": "desc", "sort_type": "score"},
            label + " [comments]",
        )
        if data and isinstance(data, dict):
            for item in data.get("data", []):
                uid = f"comment_{item.get('id', '')}"
                if uid not in seen_ids:
                    seen_ids.add(uid)
                    results.append(_normalize_comment(item))

    return results


def _parse_utc_timestamp(val) -> str:
    """Safely parse created_utc which may be int, float, or string."""
    if not val:
        return ""
    try:
        ts = int(float(val))
        return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
    except (ValueError, TypeError, OSError):
        return ""


def _normalize_submission(item: dict) -> dict:
    return {
        "source": "reddit",
        "type": "post",
        "subreddit": item.get("subreddit", ""),
        "title": item.get("title", ""),
        "body": item.get("selftext", "")[:3000],
        "score": item.get("score", 0),
        "url": f"https://reddit.com{item.get('permalink', '')}",
        "date": _parse_utc_timestamp(item.get("created_utc")),
        "author": item.get("author", "[deleted]"),
    }


def _normalize_comment(item: dict) -> dict:
    return {
        "source": "reddit",
        "type": "comment",
        "subreddit": item.get("subreddit", ""),
        "title": "",
        "body": item.get("body", "")[:3000],
        "score": item.get("score", 0),
        "url": f"https://reddit.com{item.get('permalink', '')}",
        "date": _parse_utc_timestamp(item.get("created_utc")),
        "author": item.get("author", "[deleted]"),
    }


# ── Google Places (optional) ──────────────────────────────────────────────


def _google_places_post(url: str, body: dict, label: str = "") -> dict | None:
    """POST to Google Places API (New) with retry + rate-limit delay."""
    time.sleep(API_DELAY)
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
    }
    for attempt in range(3):
        try:
            r = requests.post(url, json=body, headers=headers, timeout=30)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 429:
                wait = 5 * (attempt + 1)
                log(f"  Rate-limited on {label}, waiting {wait}s...")
                time.sleep(wait)
                continue
            log(f"  {label} returned {r.status_code}: {r.text[:200]}")
            return None
        except requests.RequestException as e:
            log(f"  {label} error: {e}")
            if attempt < 2:
                time.sleep(3)
    return None


def _google_places_get(url: str, headers: dict, label: str = "") -> dict | None:
    """GET from Google Places API (New) with retry + rate-limit delay."""
    time.sleep(API_DELAY)
    for attempt in range(3):
        try:
            r = requests.get(url, headers=headers, timeout=30)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 429:
                wait = 5 * (attempt + 1)
                log(f"  Rate-limited on {label}, waiting {wait}s...")
                time.sleep(wait)
                continue
            log(f"  {label} returned {r.status_code}: {r.text[:200]}")
            return None
        except requests.RequestException as e:
            log(f"  {label} error: {e}")
            if attempt < 2:
                time.sleep(3)
    return None


def search_google_reviews(address: str, name: str) -> list[dict]:
    """Fetch Google Places reviews using the Places API (New)."""
    if not GOOGLE_PLACES_KEY:
        return []

    search_text = f"{name} {address} Chicago IL" if name else f"{address} Chicago IL"
    log(f"  Google Places (New): searching for {search_text!r}")

    # Step 1: Text Search to find the place
    search_url = "https://places.googleapis.com/v1/places:searchText"
    search_body = {
        "textQuery": search_text,
        "maxResultCount": 1,
    }
    headers_search = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    }

    time.sleep(API_DELAY)
    try:
        r = requests.post(search_url, json=search_body, headers=headers_search, timeout=30)
        if r.status_code != 200:
            log(f"  Google search returned {r.status_code}: {r.text[:200]}")
            return []
        search_data = r.json()
    except requests.RequestException as e:
        log(f"  Google search error: {e}")
        return []

    places = search_data.get("places", [])
    if not places:
        log("  Google: no places found")
        return []

    place_id = places[0]["id"]
    place_name = places[0].get("displayName", {}).get("text", "")
    log(f"  Google: found '{place_name}' (id: {place_id})")

    # Step 2: Get Place Details with reviews
    details_url = f"https://places.googleapis.com/v1/places/{place_id}"
    details_headers = {
        "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask": "reviews",
    }
    details_data = _google_places_get(details_url, details_headers, "Google details")

    if not details_data:
        return []

    results = []
    for review in details_data.get("reviews", []):
        # Parse the publish time (ISO 8601 format in new API)
        pub_time = review.get("publishTime", "")
        date_str = ""
        if pub_time:
            try:
                date_str = pub_time[:10]  # "2024-01-15T..." -> "2024-01-15"
            except (ValueError, IndexError):
                pass

        body_text = review.get("text", {}).get("text", "") if isinstance(review.get("text"), dict) else review.get("text", "")

        results.append({
            "source": "google",
            "type": "review",
            "subreddit": "",
            "title": "",
            "body": body_text[:3000],
            "score": review.get("rating", 0),
            "url": review.get("googleMapsUri", ""),
            "date": date_str,
            "author": review.get("authorAttribution", {}).get("displayName", "Anonymous"),
        })

    return results


# ── Claude analysis ────────────────────────────────────────────────────────


ANALYSIS_PROMPT = """\
You are analyzing public online mentions about a specific apartment building to create a tenant experience report.

BUILDING INFO:
- Address: {address}
- Building Name: {name}
- Management Company: {management}

Below are {count} raw mentions found on Reddit and/or Google Reviews. Many may be IRRELEVANT (about different buildings, neighborhoods in general, or unrelated topics). Your job:

1. FILTER: Identify which mentions are actually about THIS specific building (or its management company in the context of this building). Discard irrelevant ones.

2. For each RELEVANT mention, create a paraphrased summary (NEVER use direct quotes — always rephrase in your own words). Include:
   - A 1-2 sentence paraphrased summary
   - Source (e.g., "Reddit r/chicago" or "Google Reviews")
   - Date if available
   - Sentiment: Positive, Negative, or Neutral

3. Determine OVERALL sentiment across all relevant mentions: Positive, Mixed, or Negative

4. Identify KEY THEMES from these categories (only include ones actually mentioned):
   maintenance, pests, noise, management, security, move_out_fees, amenities, location, parking, heating_cooling, appliances, water, neighbors, rent_value, cleanliness, communication, lease_terms

5. Write a 2-4 sentence overall SUMMARY of tenant sentiment about this building.

Respond in this exact JSON format:
{{
  "relevant_count": <number>,
  "overall_sentiment": "Positive" | "Mixed" | "Negative",
  "overall_summary": "<2-4 sentence summary>",
  "key_themes": ["theme1", "theme2"],
  "reports": [
    {{
      "summary": "<paraphrased 1-2 sentence summary>",
      "source": "<source attribution>",
      "date": "<YYYY-MM-DD or empty>",
      "sentiment": "Positive" | "Negative" | "Neutral"
    }}
  ]
}}

If NO mentions are relevant, return:
{{
  "relevant_count": 0,
  "overall_sentiment": "Neutral",
  "overall_summary": "No relevant tenant experiences found for this building in public forums.",
  "key_themes": [],
  "reports": []
}}

RAW MENTIONS:
{mentions}
"""


def analyze_with_claude(
    address: str, name: str, management: str, mentions: list[dict]
) -> dict:
    """Send mentions to Claude for filtering + analysis."""
    if not ANTHROPIC_KEY:
        log("  ERROR: ANTHROPIC_API_KEY not set")
        return _empty_analysis()

    if not mentions:
        log("  No mentions to analyze")
        return _empty_analysis()

    # Format mentions for the prompt
    mention_texts = []
    for i, m in enumerate(mentions, 1):
        parts = [f"[{i}] Source: {m['source']}"]
        if m["subreddit"]:
            parts[0] += f" r/{m['subreddit']}"
        if m["date"]:
            parts.append(f"Date: {m['date']}")
        if m["title"]:
            parts.append(f"Title: {m['title']}")
        parts.append(f"Content: {m['body'][:1500]}")
        if m["score"]:
            parts.append(f"Score/Rating: {m['score']}")
        mention_texts.append("\n".join(parts))

    prompt = ANALYSIS_PROMPT.format(
        address=address,
        name=name,
        management=management,
        count=len(mentions),
        mentions="\n\n---\n\n".join(mention_texts),
    )

    log(f"  Sending {len(mentions)} mentions to Claude for analysis...")
    time.sleep(API_DELAY)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text

        # Extract JSON from response (handle markdown code blocks)
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        return json.loads(text.strip())

    except ImportError:
        log("  ERROR: anthropic package not installed. Run: pip install anthropic")
        return _empty_analysis()
    except json.JSONDecodeError as e:
        log(f"  ERROR: Failed to parse Claude response as JSON: {e}")
        return _empty_analysis()
    except Exception as e:
        log(f"  ERROR: Claude API call failed: {e}")
        return _empty_analysis()


def _empty_analysis() -> dict:
    return {
        "relevant_count": 0,
        "overall_sentiment": "Neutral",
        "overall_summary": "No relevant tenant experiences found for this building in public forums.",
        "key_themes": [],
        "reports": [],
    }


# ── Process one building ──────────────────────────────────────────────────


def process_building(address: str, name: str, management: str) -> dict:
    """Full pipeline for one building: scrape → analyze → return result."""
    log(f"Processing: {name or address}")

    queries = build_queries(address, name, management)
    log(f"  Search queries: {queries}")

    # Scrape Reddit
    reddit_mentions = search_reddit(queries)
    log(f"  Reddit: found {len(reddit_mentions)} raw mentions")

    # Scrape Google (optional)
    google_mentions = search_google_reviews(address, name)
    if google_mentions:
        log(f"  Google: found {len(google_mentions)} reviews")

    all_mentions = reddit_mentions + google_mentions
    log(f"  Total raw mentions: {len(all_mentions)}")

    # Analyze with Claude
    analysis = analyze_with_claude(address, name, management, all_mentions)

    return {
        "address": address,
        "building_name": name,
        "management_company": management,
        "raw_review_count": len(all_mentions),
        "relevant_review_count": analysis.get("relevant_count", 0),
        "overall_sentiment": analysis.get("overall_sentiment", "Neutral"),
        "overall_summary": analysis.get("overall_summary", ""),
        "key_themes": analysis.get("key_themes", []),
        "reports": analysis.get("reports", []),
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": DISCLAIMER,
    }


# ── Output writers ─────────────────────────────────────────────────────────


def save_json(results: list[dict], path: str) -> None:
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": DISCLAIMER,
        "building_count": len(results),
        "buildings": results,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    log(f"Saved JSON: {path}")


def save_csv(results: list[dict], path: str) -> None:
    fieldnames = [
        "address",
        "building_name",
        "management_company",
        "raw_review_count",
        "relevant_review_count",
        "overall_sentiment",
        "summary",
        "key_themes",
        "report_date",
        "report_source",
        "report_sentiment",
        "report_summary",
        "processed_at",
    ]

    rows: list[dict] = []
    for bldg in results:
        if bldg["reports"]:
            for report in bldg["reports"]:
                rows.append({
                    "address": bldg["address"],
                    "building_name": bldg["building_name"],
                    "management_company": bldg["management_company"],
                    "raw_review_count": bldg["raw_review_count"],
                    "relevant_review_count": bldg["relevant_review_count"],
                    "overall_sentiment": bldg["overall_sentiment"],
                    "summary": bldg["overall_summary"],
                    "key_themes": "|".join(bldg["key_themes"]),
                    "report_date": report.get("date", ""),
                    "report_source": report.get("source", ""),
                    "report_sentiment": report.get("sentiment", ""),
                    "report_summary": report.get("summary", ""),
                    "processed_at": bldg["processed_at"],
                })
        else:
            # One row even with no reports so the building appears
            rows.append({
                "address": bldg["address"],
                "building_name": bldg["building_name"],
                "management_company": bldg["management_company"],
                "raw_review_count": bldg["raw_review_count"],
                "relevant_review_count": 0,
                "overall_sentiment": bldg["overall_sentiment"],
                "summary": bldg["overall_summary"],
                "key_themes": "",
                "report_date": "",
                "report_source": "",
                "report_sentiment": "",
                "report_summary": "",
                "processed_at": bldg["processed_at"],
            })

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    log(f"Saved CSV: {path}")


# ── Supabase upload ────────────────────────────────────────────────────────


def upload_to_supabase(result: dict) -> bool:
    """Upsert a building result into the community_reviews table via REST API.
    Returns True on success, False on skip/failure."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False

    address = result.get("address", "")
    if not address:
        return False

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    row = {
        "building_name": result.get("building_name", ""),
        "management_company": result.get("management_company", ""),
        "overall_sentiment": result.get("overall_sentiment", "Neutral"),
        "overall_summary": result.get("overall_summary", ""),
        "key_themes": result.get("key_themes", []),
        "raw_review_count": result.get("raw_review_count", 0),
        "relevant_review_count": result.get("relevant_review_count", 0),
        "reports": result.get("reports", []),
        "processed_at": result.get("processed_at", datetime.now(timezone.utc).isoformat()),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    base_url = f"{SUPABASE_URL}/rest/v1/community_reviews"
    addr_upper = address.upper()

    try:
        # Check if row already exists (case-insensitive)
        check = requests.get(
            base_url,
            headers=headers,
            params={"address": f"ilike.{addr_upper}", "select": "id"},
            timeout=15,
        )
        existing = check.json() if check.status_code == 200 else []

        if existing:
            # Update existing row
            r = requests.patch(
                base_url,
                json=row,
                headers=headers,
                params={"address": f"ilike.{addr_upper}"},
                timeout=15,
            )
        else:
            # Insert new row
            row["address"] = address
            r = requests.post(base_url, json=row, headers=headers, timeout=15)

        if r.status_code in (200, 201, 204):
            log(f"  Supabase: {'updated' if existing else 'inserted'} review for {address}")
            return True
        else:
            log(f"  Supabase: upload failed ({r.status_code}): {r.text[:200]}")
            return False
    except requests.RequestException as e:
        log(f"  Supabase: upload error: {e}")
        return False


# ── CLI ────────────────────────────────────────────────────────────────────


def load_buildings_csv(path: str) -> list[dict]:
    buildings = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            buildings.append({
                "address": row.get("address", "").strip(),
                "name": row.get("building_name", "").strip(),
                "management": row.get("management_company", "").strip(),
            })
    return buildings


def main() -> None:
    parser = argparse.ArgumentParser(
        description="TenantShield Review Aggregator — scrape and summarize tenant experiences"
    )
    parser.add_argument("--address", help="Single building street address")
    parser.add_argument("--name", help="Building name", default="")
    parser.add_argument("--management", help="Management company name", default="")
    parser.add_argument("--buildings", help="Path to CSV file with multiple buildings")
    parser.add_argument(
        "--output",
        help="Output JSON path (default: tenant_reviews_output.json)",
        default="tenant_reviews_output.json",
    )
    args = parser.parse_args()

    if not args.address and not args.buildings:
        parser.error("Provide --address for a single building or --buildings for a CSV batch")

    if not ANTHROPIC_KEY:
        log("WARNING: ANTHROPIC_API_KEY not set. Analysis step will be skipped.")

    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        log("Supabase upload enabled.")
    else:
        log("Supabase upload disabled (SUPABASE_URL / SUPABASE_SERVICE_KEY not set).")

    # Build list of buildings
    buildings: list[dict] = []
    if args.buildings:
        buildings = load_buildings_csv(args.buildings)
        log(f"Loaded {len(buildings)} buildings from {args.buildings}")
    else:
        buildings = [{"address": args.address, "name": args.name, "management": args.management}]

    # Load existing progress file if it exists (crash recovery)
    progress_path = args.output + ".progress.json"
    completed: dict[str, dict] = {}
    if os.path.exists(progress_path):
        with open(progress_path, encoding="utf-8") as f:
            progress_data = json.load(f)
            for bldg in progress_data.get("buildings", []):
                completed[bldg["address"]] = bldg
        log(f"Resuming: {len(completed)} buildings already processed")

    # Process each building
    results: list[dict] = []
    for i, b in enumerate(buildings, 1):
        addr = b["address"]

        # Skip if already done (crash recovery)
        if addr in completed:
            log(f"[{i}/{len(buildings)}] Skipping {addr} (already processed)")
            results.append(completed[addr])
            continue

        log(f"\n[{i}/{len(buildings)}] -------------------------------------")
        result = process_building(addr, b["name"], b["management"])
        results.append(result)

        # Upload to Supabase (if configured)
        upload_to_supabase(result)

        # Save progress after each building
        save_json(results, progress_path)

    # Write final outputs
    json_path = args.output
    csv_path = json_path.rsplit(".", 1)[0] + "_export.csv"
    if json_path == "tenant_reviews_output.json":
        csv_path = "tenant_reviews_export.csv"

    save_json(results, json_path)
    save_csv(results, csv_path)

    # Clean up progress file
    if os.path.exists(progress_path):
        os.remove(progress_path)

    log(f"\nDone! Processed {len(results)} buildings.")
    log(f"  JSON: {json_path}")
    log(f"  CSV:  {csv_path}")
    log(f"\nDisclaimer: {DISCLAIMER}")


if __name__ == "__main__":
    main()
