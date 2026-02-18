"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { useChicagoData, useChicagoResultsCounts } from "@/hooks/useChicagoData";
import { parseStreetAddress, generateAddressVariants, fetchBuildingViolations, fetchServiceRequests, matchNeighborhood, fetchFullNeighborhoodData, BuildingViolation, ServiceRequest, NeighborhoodResult } from "@/lib/chicagoData";
import { useAuth } from "@/hooks/useAuth";
import CityRecords from "@/components/CityRecords";
import { trackEvent } from "@/lib/analytics";

// ─── TYPES ───

interface Scores {
  maintenance: number;
  communication: number;
  deposit: number;
  honesty: number;
  overall: number;
}

interface Review {
  id: string;
  author: string;
  date: string;
  rating: number;
  text: string;
  helpful: number;
}

interface Landlord {
  id: string;
  slug: string;
  name: string;
  addresses: string[];
  neighborhood: string;
  type: string;
  scores: Scores;
  reviewCount: number;
  violations: number;
  complaints: number;
  reviews: Review[];
}

interface ReviewForm {
  landlordName: string;
  address: string;
  maintenance: number;
  communication: number;
  deposit: number;
  honesty: number;
  overall: number;
  text: string;
}

// ─── SEED DATA (fallback when Supabase is not configured) ───

const SEED_LANDLORDS: Landlord[] = [];

// ─── HELPERS ───

function getScoreColor(s: number) {
  if (s >= 4) return "#1a7f37";
  if (s >= 3) return "#9a6700";
  if (s >= 2) return "#bc4c00";
  return "#cf222e";
}

function getScoreBg(s: number) {
  if (s >= 4) return "#dafbe1";
  if (s >= 3) return "#fff8c5";
  if (s >= 2) return "#fff1e5";
  return "#ffebe9";
}

function getLabel(s: number) {
  if (s >= 4.5) return "Excellent";
  if (s >= 4) return "Good";
  if (s >= 3) return "Average";
  if (s >= 2) return "Below Average";
  return "Poor";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}

// ─── DB HELPERS ───

interface DbLandlord {
  id: string;
  slug: string;
  name: string;
  neighborhood: string;
  type: string;
  violations: number;
  complaints: number;
  review_count: number;
  score_maintenance: number;
  score_communication: number;
  score_deposit: number;
  score_honesty: number;
  score_overall: number;
}

interface DbAddress {
  address: string;
}

interface DbReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  helpful: number;
  created_at: string;
}

function dbToLandlord(
  ll: DbLandlord,
  addresses: DbAddress[],
  reviews: DbReview[]
): Landlord {
  return {
    id: ll.id,
    slug: ll.slug,
    name: ll.name,
    addresses: addresses.map((a) => a.address),
    neighborhood: ll.neighborhood,
    type: ll.type,
    scores: {
      maintenance: ll.score_maintenance,
      communication: ll.score_communication,
      deposit: ll.score_deposit,
      honesty: ll.score_honesty,
      overall: ll.score_overall,
    },
    reviewCount: ll.review_count,
    violations: ll.violations,
    complaints: ll.complaints,
    reviews: reviews.map((r) => ({
      id: r.id,
      author: r.author,
      date: formatDate(r.created_at),
      rating: r.rating,
      text: r.text,
      helpful: r.helpful,
    })),
  };
}

async function fetchAllLandlords(): Promise<Landlord[]> {
  const { data: landlords, error } = await getSupabase()!
    .from("landlords")
    .select("*")
    .order("name");
  if (error || !landlords) return [];

  const results: Landlord[] = [];
  for (const ll of landlords as DbLandlord[]) {
    const { data: addresses } = await getSupabase()!
      .from("addresses")
      .select("address")
      .eq("landlord_id", ll.id);
    const { data: reviews } = await getSupabase()!
      .from("reviews")
      .select("*")
      .eq("landlord_id", ll.id)
      .order("created_at", { ascending: false });
    results.push(
      dbToLandlord(ll, (addresses || []) as DbAddress[], (reviews || []) as DbReview[])
    );
  }
  return results;
}

async function searchLandlords(query: string): Promise<Landlord[]> {
  const term = `%${query}%`;

  // Search landlords by name or neighborhood
  const { data: byName } = await getSupabase()!
    .from("landlords")
    .select("*")
    .or(`name.ilike.${term},neighborhood.ilike.${term}`);

  // Search by address
  const { data: byAddress } = await getSupabase()!
    .from("addresses")
    .select("landlord_id, address")
    .ilike("address", term);

  const landlordIds = new Set<string>();
  const landlords: DbLandlord[] = [];

  for (const ll of (byName || []) as DbLandlord[]) {
    if (!landlordIds.has(ll.id)) {
      landlordIds.add(ll.id);
      landlords.push(ll);
    }
  }

  if (byAddress && byAddress.length > 0) {
    const addressLandlordIds = byAddress
      .map((a) => a.landlord_id as string)
      .filter((id) => !landlordIds.has(id));
    if (addressLandlordIds.length > 0) {
      const { data: extra } = await getSupabase()!
        .from("landlords")
        .select("*")
        .in("id", addressLandlordIds);
      for (const ll of (extra || []) as DbLandlord[]) {
        if (!landlordIds.has(ll.id)) {
          landlordIds.add(ll.id);
          landlords.push(ll);
        }
      }
    }
  }

  const results: Landlord[] = [];
  for (const ll of landlords) {
    const { data: addresses } = await getSupabase()!
      .from("addresses")
      .select("address")
      .eq("landlord_id", ll.id);
    const { data: reviews } = await getSupabase()!
      .from("reviews")
      .select("*")
      .eq("landlord_id", ll.id)
      .order("created_at", { ascending: false });
    results.push(
      dbToLandlord(ll, (addresses || []) as DbAddress[], (reviews || []) as DbReview[])
    );
  }
  return results;
}

async function submitReviewToDb(
  landlordId: string,
  form: ReviewForm,
  userId?: string
): Promise<boolean> {
  const { error } = await getSupabase()!.from("reviews").insert({
    landlord_id: landlordId,
    author: "Anonymous Tenant",
    rating: form.overall,
    text: form.text,
    helpful: 0,
    maintenance: form.maintenance || null,
    communication: form.communication || null,
    deposit: form.deposit || null,
    honesty: form.honesty || null,
    ...(userId ? { user_id: userId } : {}),
  });
  if (error) return false;

  // Recalculate landlord scores
  const { data: reviews } = await getSupabase()!
    .from("reviews")
    .select("rating")
    .eq("landlord_id", landlordId);
  if (reviews && reviews.length > 0) {
    const avgRating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await getSupabase()!
      .from("landlords")
      .update({
        review_count: reviews.length,
        score_overall: Math.round(avgRating * 10) / 10,
      })
      .eq("id", landlordId);
  }
  return true;
}

// ─── SUB-COMPONENTS ───

function Stars({
  rating,
  size = 15,
  interactive = false,
  onChange,
}: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => interactive && onChange?.(s)}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          style={{
            fontSize: size,
            cursor: interactive ? "pointer" : "default",
            color: s <= (hover || rating) ? "#f4a623" : "#d1d5db",
            transition: "color 0.1s",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 10,
      }}
    >
      <span
        style={{ width: 140, fontSize: 13, color: "#57606a", fontWeight: 500 }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "#e8ecf0",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${(score / 5) * 100}%`,
            height: "100%",
            background: getScoreColor(score),
            borderRadius: 3,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span
        style={{
          width: 28,
          fontSize: 13,
          fontWeight: 600,
          color: getScoreColor(score),
          textAlign: "right",
        }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div style={{ borderBottom: "1px solid #e8ecf0", padding: "20px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Stars rating={review.rating} size={13} />
            <span
              style={{ fontSize: 13, fontWeight: 600, color: "#1f2328" }}
            >
              {review.author}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2 }}>
            {review.date}
          </div>
        </div>
      </div>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: "#424a53",
          margin: "8px 0 0",
        }}
      >
        {review.text}
      </p>
      {review.helpful > 0 && (
        <div style={{ marginTop: 10 }}>
          <button
            style={{
              fontSize: 12,
              color: "#57606a",
              background: "#f6f8fa",
              border: "1px solid #e8ecf0",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            👍 Helpful ({review.helpful})
          </button>
        </div>
      )}
    </div>
  );
}

const ADMIN_EMAIL = "njecelin17@gmail.com";

// ─── MAIN COMPONENT ───

export default function TenantShield() {
  const [view, setView] = useState("home");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Landlord[]>([]);
  const [selected, setSelected] = useState<Landlord | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [landlords, setLandlords] = useState<Landlord[]>(SEED_LANDLORDS);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ReviewForm>({
    landlordName: "",
    address: "",
    maintenance: 0,
    communication: 0,
    deposit: 0,
    honesty: 0,
    overall: 0,
    text: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [returnView, setReturnView] = useState<string | null>(null);
  const [userReviews, setUserReviews] = useState<
    { review: Review; landlordName: string }[]
  >([]);
  const [addressResult, setAddressResult] = useState<{
    address: string;
    violations: BuildingViolation[];
    complaints: ServiceRequest[];
  } | null>(null);
  const [showAllProfileViolations, setShowAllProfileViolations] = useState(false);
  const [showAllProfileComplaints, setShowAllProfileComplaints] = useState(false);
  const [neighborhoodResult, setNeighborhoodResult] = useState<NeighborhoodResult | null>(null);
  const [showAllNhViolations, setShowAllNhViolations] = useState(false);
  const [showAllNhComplaints, setShowAllNhComplaints] = useState(false);
  const [adminReviewPage, setAdminReviewPage] = useState(0);
  const [adminData, setAdminData] = useState<{
    searchCount7d: number;
    searchCountAll: number;
    pageViewCount7d: number;
    pageViewCountAll: number;
    totalReviews: number;
    uniqueReviewers: number;
    totalSignups: number;
    recentSearches: { query: string; created_at: string; resultCount?: number; hasAddressResult?: boolean }[];
    popularLandlords: { name: string; views: number }[];
    recentReviews: { landlord_name: string; address: string; rating: number; created_at: string; text: string }[];
    activityFeed: { event_type: string; event_data: Record<string, unknown>; created_at: string }[];
  } | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const auth = useAuth();
  const isAdmin = auth.user?.email === ADMIN_EMAIL;

  const cityData = useChicagoData(
    view === "profile" && selected ? selected.addresses : null
  );

  const resultsCityData = useChicagoResultsCounts(
    view === "results" && results.length > 0 ? results : null
  );

  // Fetch user reviews when auth state changes
  useEffect(() => {
    if (!auth.user || !isSupabaseConfigured()) {
      setUserReviews([]);
      return;
    }
    (async () => {
      const { data } = await getSupabase()!
        .from("reviews")
        .select("*, landlords(name)")
        .eq("user_id", auth.user!.id)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setHasReviewed(true);
        setUserReviews(
          data.map((r: Record<string, unknown>) => ({
            review: {
              id: r.id as string,
              author: r.author as string,
              date: formatDate(r.created_at as string),
              rating: r.rating as number,
              text: r.text as string,
              helpful: r.helpful as number,
            },
            landlordName:
              (r.landlords as Record<string, unknown>)?.name as string ?? "Unknown",
          }))
        );
      }
    })();
  }, [auth.user]);

  // Handle returnView after OAuth redirect (Google sign-in)
  useEffect(() => {
    if (!auth.user) return;
    const pending = localStorage.getItem("tenantshield_returnView");
    if (pending) {
      localStorage.removeItem("tenantshield_returnView");
      if (pending === "review") {
        setForm({
          landlordName: "",
          address: "",
          maintenance: 0,
          communication: 0,
          deposit: 0,
          honesty: 0,
          overall: 0,
          text: "",
        });
        setSubmitted(false);
      }
      setView(pending);
    }
  }, [auth.user]);

  // Load landlords from Supabase on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    fetchAllLandlords()
      .then((data) => {
        if (data.length > 0) setLandlords(data);
      })
      .finally(() => setLoading(false));
  }, []);

  // Track page views when view changes
  useEffect(() => {
    if (view === "home" || view === "login" || view === "signup") return;
    const data: Record<string, unknown> = { view };
    if (view === "profile" && selected) data.landlord = selected.slug;
    trackEvent("page_view", data, auth.user?.id);
  }, [view, selected, auth.user?.id]);

  // Track login events
  useEffect(() => {
    if (auth.user) {
      trackEvent("login", { method: auth.user.app_metadata?.provider || "email" }, auth.user.id);
    }
  }, [auth.user?.id]);

  // Load admin dashboard data
  useEffect(() => {
    if (view !== "admin" || !isAdmin || !isSupabaseConfigured()) return;
    setAdminLoading(true);
    (async () => {
      const sb = getSupabase()!;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { count: searchCount7d },
        { count: searchCountAll },
        { count: pageViewCount7d },
        { count: pageViewCountAll },
        { count: totalReviews },
        { data: reviewerData },
        { data: recentSearchesRaw },
        { data: pageViewsRaw },
        { data: recentReviewsRaw },
        { data: activityFeedRaw },
        { data: loginUsersRaw },
      ] = await Promise.all([
        sb.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "search").gte("created_at", sevenDaysAgo),
        sb.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "search"),
        sb.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "page_view").gte("created_at", sevenDaysAgo),
        sb.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "page_view"),
        sb.from("reviews").select("*", { count: "exact", head: true }),
        sb.from("reviews").select("user_id"),
        sb.from("analytics_events").select("event_data, created_at").eq("event_type", "search").order("created_at", { ascending: false }).limit(200),
        sb.from("analytics_events").select("event_data, created_at").eq("event_type", "page_view").order("created_at", { ascending: false }).limit(200),
        sb.from("reviews").select("*, landlords(name, addresses(address))").order("created_at", { ascending: false }).limit(500),
        sb.from("analytics_events").select("event_type, event_data, created_at").order("created_at", { ascending: false }).limit(30),
        sb.from("analytics_events").select("user_id").eq("event_type", "login"),
      ]);

      // Aggregate popular landlords from page_view events
      const landlordViews: Record<string, number> = {};
      for (const pv of (pageViewsRaw || [])) {
        const name = (pv.event_data as Record<string, unknown>)?.landlord as string;
        if (name) landlordViews[name] = (landlordViews[name] || 0) + 1;
      }
      const popularLandlords = Object.entries(landlordViews)
        .map(([name, views]) => ({ name, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Count unique reviewers
      const uniqueUserIds = new Set((reviewerData || []).map((r: { user_id: string }) => r.user_id).filter(Boolean));

      // Count unique signups (distinct user_ids from login events)
      const signupUserIds = new Set((loginUsersRaw || []).map((r: { user_id: string }) => r.user_id).filter(Boolean));

      setAdminData({
        searchCount7d: searchCount7d ?? 0,
        searchCountAll: searchCountAll ?? 0,
        pageViewCount7d: pageViewCount7d ?? 0,
        pageViewCountAll: pageViewCountAll ?? 0,
        totalReviews: totalReviews ?? 0,
        uniqueReviewers: uniqueUserIds.size,
        totalSignups: signupUserIds.size,
        recentSearches: (recentSearchesRaw || []).map((r: { event_data: Record<string, unknown>; created_at: string }) => ({
          query: (r.event_data?.query as string) || "—",
          created_at: r.created_at,
          resultCount: r.event_data?.resultCount as number | undefined,
          hasAddressResult: r.event_data?.hasAddressResult as boolean | undefined,
        })),
        popularLandlords,
        recentReviews: (recentReviewsRaw || []).map((r: Record<string, unknown>) => {
          const landlordObj = r.landlords as Record<string, unknown> | undefined;
          const addrs = landlordObj?.addresses as { address: string }[] | undefined;
          return {
            landlord_name: (landlordObj?.name as string) || "Unknown",
            address: addrs?.[0]?.address || "",
            rating: r.rating as number,
            created_at: r.created_at as string,
            text: (r.text as string) || "",
          };
        }),
        activityFeed: (activityFeedRaw || []).map((r: { event_type: string; event_data: Record<string, unknown>; created_at: string }) => ({
          event_type: r.event_type,
          event_data: r.event_data || {},
          created_at: r.created_at,
        })),
      });
      setAdminLoading(false);
    })();
  }, [view, isAdmin]);

  const doSearch = useCallback(
    async (q?: string) => {
      const t = (q || query).toLowerCase().trim();
      if (!t) return;

      setAddressResult(null);
      setNeighborhoodResult(null);
      let found: Landlord[] = [];
      let addressResultData: { address: string; violations: BuildingViolation[]; complaints: ServiceRequest[] } | null = null;
      let neighborhoodMatch = false;

      // Check if the search term matches a known neighborhood
      const nhMatch = matchNeighborhood(t);
      if (nhMatch) {
        setLoading(true);
        try {
          const nhData = await fetchFullNeighborhoodData(nhMatch.id, nhMatch.name);
          setNeighborhoodResult(nhData);
          setShowAllNhViolations(false);
          setShowAllNhComplaints(false);
          neighborhoodMatch = true;
        } catch {
          // Neighborhood fetch failed, fall through to normal search
        }
      }

      if (isSupabaseConfigured()) {
        setLoading(true);
        found = await searchLandlords(t);
        setResults(found);
      } else {
        const f: Landlord[] = [];
        const seen = new Set<string>();
        for (const ll of landlords) {
          const m =
            ll.name.toLowerCase().includes(t) ||
            ll.neighborhood.toLowerCase().includes(t) ||
            ll.addresses.some((a) => a.toLowerCase().includes(t));
          if (m && !seen.has(ll.id)) {
            f.push(ll);
            seen.add(ll.id);
          }
        }
        found = f;
        setResults(f);
      }

      // Also query Chicago Open Data Portal directly for the search term as an address
      if (!neighborhoodMatch) {
        try {
          const parsed = parseStreetAddress(q || query);
          if (parsed) {
            const variants = generateAddressVariants(parsed);
            const [violations, complaints] = await Promise.all([
              fetchBuildingViolations(variants),
              fetchServiceRequests(variants),
            ]);
            // Only show address result if we got city data AND it's not already covered by a landlord result
            const alreadyCovered = found.some((ll) =>
              ll.addresses.some(
                (a) => parseStreetAddress(a) === parsed
              )
            );
            if ((violations.length > 0 || complaints.length > 0) && !alreadyCovered) {
              addressResultData = {
                address: (q || query).split(",")[0].trim(),
                violations,
                complaints,
              };
              setAddressResult(addressResultData);
            }
          }
        } catch {
          // Chicago API errors shouldn't block the search
        }
      }

      // Track search event after results are known
      trackEvent("search", {
        query: t,
        resultCount: found.length,
        hasAddressResult: !!addressResultData,
        isNeighborhood: neighborhoodMatch,
      }, auth.user?.id);

      setLoading(false);
      setView("results");
    },
    [query, landlords, auth.user?.id]
  );

  function openProfile(ll: Landlord) {
    setSelected(ll);
    setView("profile");
  }

  function goReview() {
    setShowGate(false);
    if (!auth.user && isSupabaseConfigured()) {
      setReturnView("review");
      setView("login");
      return;
    }
    setForm({
      landlordName: "",
      address: "",
      maintenance: 0,
      communication: 0,
      deposit: 0,
      honesty: 0,
      overall: 0,
      text: "",
    });
    setSubmitted(false);
    setView("review");
  }

  function goHome() {
    setView("home");
    setQuery("");
    setResults([]);
    setSelected(null);
    setAddressResult(null);
    setNeighborhoodResult(null);
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text || !form.landlordName || !form.overall) return;

    const ex = landlords.find(
      (ll) => ll.name.toLowerCase() === form.landlordName.toLowerCase()
    );

    if (isSupabaseConfigured() && ex) {
      setLoading(true);
      const ok = await submitReviewToDb(ex.id, form, auth.user?.id);
      if (ok) {
        // Refresh landlord data
        const updated = await fetchAllLandlords();
        if (updated.length > 0) setLandlords(updated);
      }
      setLoading(false);
    } else if (ex) {
      const nr: Review = {
        id: "r-u-" + Date.now(),
        author: "Anonymous Tenant",
        date: formatDate(new Date().toISOString()),
        rating: form.overall,
        text: form.text,
        helpful: 0,
      };
      setLandlords((p) =>
        p.map((ll) =>
          ll.id === ex.id
            ? { ...ll, reviews: [nr, ...ll.reviews], reviewCount: ll.reviewCount + 1 }
            : ll
        )
      );
    }
    setHasReviewed(true);
    setSubmitted(true);
    trackEvent("review_submit", { landlord: form.landlordName, rating: form.overall }, auth.user?.id);
  }

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "#fff",
    border: "1px solid #d0d7de",
    borderRadius: 6,
    color: "#1f2328",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  if (auth.loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f8fa",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
        }}
      >
        <span style={{ fontSize: 15, color: "#57606a" }}>Loading...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8fa",
        color: "#1f2328",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          background: "#fff",
          borderBottom: "1px solid #e8ecf0",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
          onClick={goHome}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1f6feb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#1f2328",
              letterSpacing: -0.3,
            }}
          >
            TenantShield
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {hasReviewed && (
            <span style={{ fontSize: 12, color: "#1a7f37", fontWeight: 600 }}>
              ✓ Full Access
            </span>
          )}
          {auth.user ? (
            <>
              {isAdmin && (
                <button
                  onClick={() => setView("admin")}
                  style={{
                    padding: "7px 16px",
                    background: "#f0e6ff",
                    border: "1px solid #d4b8ff",
                    borderRadius: 6,
                    color: "#6e40c9",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Admin
                </button>
              )}
              <button
                onClick={() => setView("account")}
                style={{
                  padding: "7px 16px",
                  background: "#f6f8fa",
                  border: "1px solid #d0d7de",
                  borderRadius: 6,
                  color: "#1f2328",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Account
              </button>
              <button
                onClick={async () => {
                  await auth.signOut();
                  setHasReviewed(false);
                  setUserReviews([]);
                }}
                style={{
                  padding: "7px 16px",
                  background: "transparent",
                  border: "1px solid #d0d7de",
                  borderRadius: 6,
                  color: "#57606a",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Log Out
              </button>
              <button
                onClick={goReview}
                style={{
                  padding: "7px 16px",
                  background: "#1f6feb",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Write a Review
              </button>
            </>
          ) : (
            <>
              <span
                onClick={() => { auth.clearError(); setLoginEmail(""); setLoginPassword(""); setView("login"); }}
                style={{
                  fontSize: 13,
                  color: "#57606a",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Sign In
              </span>
              <button
                onClick={goReview}
                style={{
                  padding: "7px 16px",
                  background: "#1f6feb",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Write a Review
              </button>
            </>
          )}
        </div>
      </nav>

      {view !== "home" && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 20px 0" }}>
          <button
            onClick={() => {
              if (view === "profile" || view === "address-profile") setView("results");
              else if (view === "review" && selected) setView("profile");
              else if (view === "login" || view === "signup" || view === "account" || view === "admin") goHome();
              else goHome();
            }}
            style={{
              background: "none",
              border: "none",
              color: "#57606a",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
            }}
          >
            ← Back
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <span style={{ fontSize: 14, color: "#57606a" }}>Loading...</span>
        </div>
      )}

      {/* ─── HOME ─── */}
      {view === "home" && (
        <div>
          <div
            style={{
              padding: "80px 20px 60px",
              textAlign: "center",
              borderBottom: "1px solid #e8ecf0",
              background: "#fff",
            }}
          >
            <h1
              style={{
                fontSize: "clamp(28px,5vw,44px)",
                fontWeight: 700,
                color: "#1f2328",
                margin: "0 0 12px",
                lineHeight: 1.2,
              }}
            >
              Research your landlord before you sign the lease.
            </h1>
            <p
              style={{
                fontSize: 17,
                color: "#57606a",
                maxWidth: 540,
                margin: "0 auto 32px",
                lineHeight: 1.6,
              }}
            >
              Tenant reviews, building violations, and landlord ratings for
              Chicago rental properties — all in one place.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                doSearch();
              }}
              style={{
                display: "flex",
                maxWidth: 580,
                margin: "0 auto",
                border: "1px solid #d0d7de",
                borderRadius: 8,
                overflow: "hidden",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by address, landlord name, or neighborhood"
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  border: "none",
                  outline: "none",
                  fontSize: 15,
                  color: "#1f2328",
                  fontFamily: "inherit",
                  background: "transparent",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "0 24px",
                  background: "#1f6feb",
                  border: "none",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Search
              </button>
            </form>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginTop: 14,
                flexWrap: "wrap",
              }}
            >
              {["Lakeview", "Lincoln Park", "Peak Properties", "Gold Coast"].map(
                (t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setQuery(t);
                      doSearch(t);
                    }}
                    style={{
                      padding: "5px 12px",
                      background: "#f6f8fa",
                      border: "1px solid #e8ecf0",
                      borderRadius: 20,
                      color: "#57606a",
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {t}
                  </button>
                )
              )}
            </div>
          </div>
          <div
            style={{
              padding: "28px 20px 24px",
              borderBottom: "1px solid #e8ecf0",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 15, color: "#424a53", margin: "0 0 16px", lineHeight: 1.6 }}>
              Search any Chicago address to see real building violations and 311 complaints from city records
            </p>
            <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 10 }}>Try an example address:</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {["1550 N Lake Shore Dr", "1130 S Michigan Ave", "1401 W Division St", "6217 S Dorchester Ave"].map((addr) => (
                <button
                  key={addr}
                  onClick={() => { setQuery(addr); doSearch(addr); }}
                  style={{
                    padding: "6px 14px",
                    background: "#f6f8fa",
                    border: "1px solid #e8ecf0",
                    borderRadius: 20,
                    color: "#1f6feb",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {addr}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              padding: "56px 20px",
              maxWidth: 800,
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                textAlign: "center",
                color: "#1f2328",
                marginBottom: 36,
              }}
            >
              How TenantShield works
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                gap: 20,
              }}
            >
              {(
                [
                  [
                    "Search",
                    "Enter any Chicago address, landlord name, or neighborhood to get started.",
                  ],
                  [
                    "Review Scores",
                    "See ratings across maintenance, communication, deposit fairness, and listing honesty.",
                  ],
                  [
                    "Read Reviews",
                    "Real experiences from tenants who actually lived there.",
                  ],
                  [
                    "Rent Informed",
                    "Make confident decisions backed by data and community insights.",
                  ],
                ] as const
              ).map(([title, desc], i) => (
                <div
                  key={i}
                  style={{
                    padding: 20,
                    border: "1px solid #e8ecf0",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#1f6feb",
                      marginBottom: 8,
                    }}
                  >
                    STEP {i + 1}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#1f2328",
                      marginBottom: 6,
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{ fontSize: 13, color: "#57606a", lineHeight: 1.6 }}
                  >
                    {desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px 60px",
              background: "#fff",
              borderTop: "1px solid #e8ecf0",
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1f2328",
                margin: "0 0 8px",
              }}
            >
              Had a landlord experience — good or bad?
            </h3>
            <p
              style={{
                fontSize: 14,
                color: "#57606a",
                margin: "0 0 20px",
              }}
            >
              Your review helps the next renter make a better decision.
            </p>
            <button
              onClick={goReview}
              style={{
                padding: "12px 28px",
                background: "#1f6feb",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Write a Review
            </button>
          </div>
        </div>
      )}

      {/* ─── RESULTS ─── */}
      {view === "results" && (
        <div
          style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px" }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doSearch();
            }}
            style={{ display: "flex", gap: 8, marginBottom: 24 }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address, landlord, or neighborhood..."
              style={{ ...inp, flex: 1 }}
            />
            <button
              type="submit"
              style={{
                padding: "10px 20px",
                background: "#1f6feb",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "inherit",
              }}
            >
              Search
            </button>
          </form>
          <p
            style={{ fontSize: 13, color: "#8b949e", marginBottom: 16 }}
          >
            {results.length + (addressResult ? 1 : 0)} result{results.length + (addressResult ? 1 : 0) !== 1 ? "s" : ""} for &ldquo;
            {query}&rdquo;
            {neighborhoodResult && (
              <span> · Showing {neighborhoodResult.neighborhoodName} neighborhood data</span>
            )}
          </p>
          {results.length === 0 && !addressResult && !neighborhoodResult && (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                border: "1px solid #e8ecf0",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  color: "#424a53",
                  marginBottom: 16,
                }}
              >
                No results found matching your search.
              </p>
              <button
                onClick={goReview}
                style={{
                  padding: "10px 20px",
                  background: "#1f6feb",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              >
                Be the first to leave a review
              </button>
            </div>
          )}
          {results.map((ll) => {
            const c = getScoreColor(ll.scores.overall);
            const bg = getScoreBg(ll.scores.overall);
            return (
              <div
                key={ll.id}
                onClick={() => openProfile(ll)}
                style={{
                  border: "1px solid #e8ecf0",
                  borderRadius: 8,
                  padding: "20px 24px",
                  marginBottom: 10,
                  cursor: "pointer",
                  background: "#fff",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(0,0,0,0.08)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.boxShadow = "none")
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 4,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          margin: 0,
                          color: "#1f2328",
                        }}
                      >
                        {ll.name}
                      </h3>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: bg,
                          color: c,
                        }}
                      >
                        {ll.scores.overall.toFixed(1)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#57606a" }}>
                      {ll.neighborhood} · {ll.type}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#8b949e",
                        marginTop: 4,
                      }}
                    >
                      {ll.addresses[0]}
                      {ll.addresses.length > 1 &&
                        ` +${ll.addresses.length - 1} more`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", marginLeft: 16 }}>
                    <Stars
                      rating={Math.round(ll.scores.overall)}
                      size={13}
                    />
                    <div
                      style={{
                        fontSize: 12,
                        color: "#8b949e",
                        marginTop: 2,
                      }}
                    >
                      {ll.reviewCount} reviews
                    </div>
                  </div>
                </div>
                {(() => {
                  const rc = resultsCityData.counts[ll.id];
                  const vCount = resultsCityData.loading ? null : rc?.violations ?? 0;
                  const cCount = resultsCityData.loading ? null : rc?.complaints ?? 0;
                  return (
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "1px solid #f0f3f6",
                      }}
                    >
                      {vCount === null ? (
                        <span style={{ fontSize: 12, color: "#8b949e" }}>
                          Loading records...
                        </span>
                      ) : vCount > 0 ? (
                        <span style={{ fontSize: 12, color: "#cf222e" }}>
                          ⚠ {vCount} building violations
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#1a7f37" }}>
                          ✓ No violations on record
                        </span>
                      )}
                      {cCount !== null && cCount > 0 && (
                        <span style={{ fontSize: 12, color: "#bc4c00" }}>
                          {cCount} complaints filed
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {/* Neighborhood Results */}
          {neighborhoodResult && (
            <div style={{
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              background: "#fff",
              marginBottom: 16,
              overflow: "hidden",
            }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #e8ecf0" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2328", margin: "0 0 4px" }}>
                  {neighborhoodResult.neighborhoodName} — Neighborhood Overview
                </h3>
                <p style={{ fontSize: 13, color: "#57606a", margin: 0 }}>
                  Community Area {neighborhoodResult.communityArea} · City of Chicago Open Data
                </p>
                <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                  <span style={{ fontSize: 13, color: "#bc4c00", fontWeight: 600 }}>
                    {neighborhoodResult.totalComplaints} recent 311 complaints
                  </span>
                  <span style={{ fontSize: 13, color: "#cf222e", fontWeight: 600 }}>
                    {neighborhoodResult.totalViolations} building violations
                  </span>
                </div>
              </div>

              {/* Top addresses in the neighborhood */}
              {neighborhoodResult.topAddresses.length > 0 && (
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf0" }}>
                  <h4 style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Top Addresses by Activity
                  </h4>
                  {neighborhoodResult.topAddresses.map((a, i) => (
                    <div
                      key={a.address}
                      onClick={() => {
                        setQuery(a.address);
                        doSearch(a.address);
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: i < neighborhoodResult.topAddresses.length - 1 ? "1px solid #f0f3f6" : "none",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: 13, color: "#1f6feb", fontWeight: 500 }}>{a.address}</span>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#8b949e" }}>
                        {a.complaintCount > 0 && <span>{a.complaintCount} complaints</span>}
                        {a.violationCount > 0 && <span>{a.violationCount} violations</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent complaints in the neighborhood */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #e8ecf0" }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Recent 311 Complaints ({neighborhoodResult.recentComplaints.length})
                </h4>
                {(showAllNhComplaints ? neighborhoodResult.recentComplaints : neighborhoodResult.recentComplaints.slice(0, 8)).map((c, i, arr) => {
                  const isClosed = c.status?.toUpperCase() === "CLOSED" || c.status?.toUpperCase() === "COMPLETED";
                  return (
                    <div key={c.sr_number || i} style={{ padding: "8px 0", borderBottom: i < arr.length - 1 ? "1px solid #f0f3f6" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#1f2328" }}>{c.sr_type}</span>
                          <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                            {c.street_address} · {c.created_date ? formatDate(c.created_date) : ""}
                            {c.owner_department && <span> · {c.owner_department}</span>}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: isClosed ? "#dafbe1" : "#fff1e5",
                          color: isClosed ? "#1a7f37" : "#bc4c00",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}>
                          {isClosed ? "Resolved" : "Open"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {neighborhoodResult.recentComplaints.length > 8 && (
                  <button
                    onClick={() => setShowAllNhComplaints((p) => !p)}
                    style={{
                      display: "block", width: "100%", padding: "8px 0", background: "#f6f8fa",
                      border: "1px solid #e8ecf0", borderRadius: 6, color: "#1f6feb",
                      fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 8,
                    }}
                  >
                    {showAllNhComplaints ? "Show less" : `Show all ${neighborhoodResult.recentComplaints.length}`}
                  </button>
                )}
              </div>

              {/* Recent violations in the neighborhood */}
              <div style={{ padding: "16px 24px" }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Recent Building Violations ({neighborhoodResult.recentViolations.length})
                </h4>
                {neighborhoodResult.recentViolations.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#8b949e" }}>No violations found for top addresses in this area.</p>
                ) : (
                  <>
                    {(showAllNhViolations ? neighborhoodResult.recentViolations : neighborhoodResult.recentViolations.slice(0, 8)).map((v, i, arr) => {
                      const isOpen = v.violation_status?.toUpperCase() !== "COMPLIANT" && v.violation_status?.toUpperCase() !== "COMPLIED";
                      return (
                        <div key={v.id || i} style={{ padding: "8px 0", borderBottom: i < arr.length - 1 ? "1px solid #f0f3f6" : "none" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: "#1f2328" }}>
                                {v.violation_description || v.inspection_category || "Violation"}
                              </span>
                              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                                {v.address} · {v.violation_date ? formatDate(v.violation_date) : ""}
                                {v.department_bureau && <span> · {v.department_bureau}</span>}
                              </div>
                            </div>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: isOpen ? "#ffebe9" : "#dafbe1",
                              color: isOpen ? "#cf222e" : "#1a7f37",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}>
                              {isOpen ? "Open" : "Resolved"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {neighborhoodResult.recentViolations.length > 8 && (
                      <button
                        onClick={() => setShowAllNhViolations((p) => !p)}
                        style={{
                          display: "block", width: "100%", padding: "8px 0", background: "#f6f8fa",
                          border: "1px solid #e8ecf0", borderRadius: 6, color: "#1f6feb",
                          fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 8,
                        }}
                      >
                        {showAllNhViolations ? "Show less" : `Show all ${neighborhoodResult.recentViolations.length}`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {addressResult && (
            <div
              onClick={() => { setShowAllProfileViolations(false); setShowAllProfileComplaints(false); setView("address-profile"); }}
              style={{
                border: "1px solid #e8ecf0",
                borderRadius: 8,
                padding: "20px 24px",
                marginBottom: 10,
                background: "#fff",
                cursor: "pointer",
                transition: "box-shadow 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow = "none")
              }
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px", color: "#1f2328" }}>
                    {addressResult.address}
                  </h3>
                  <div style={{ fontSize: 13, color: "#57606a" }}>
                    Address lookup via City of Chicago
                  </div>
                </div>
                <div style={{
                  padding: "6px 12px",
                  background: "#f6f8fa",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#57606a",
                  fontWeight: 600,
                }}>
                  City Data
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f3f6" }}>
                {addressResult.violations.length > 0 ? (
                  <span style={{ fontSize: 12, color: "#cf222e" }}>
                    ⚠ {addressResult.violations.length} building violation{addressResult.violations.length !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: "#1a7f37" }}>
                    ✓ No violations on record
                  </span>
                )}
                {addressResult.complaints.length > 0 && (
                  <span style={{ fontSize: 12, color: "#bc4c00" }}>
                    {addressResult.complaints.length} complaint{addressResult.complaints.length !== 1 ? "s" : ""} filed
                  </span>
                )}
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "#1f6feb", fontWeight: 500 }}>
                View all records &rarr;
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); goReview(); }}
                  style={{
                    padding: "8px 16px",
                    background: "#fff",
                    border: "1px solid #d0d7de",
                    borderRadius: 6,
                    color: "#1f2328",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  No reviews yet — be the first
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── PROFILE ─── */}
      {view === "profile" &&
        selected &&
        (() => {
          const ll =
            landlords.find((l) => l.id === selected.id) || selected;
          const c = getScoreColor(ll.scores.overall);
          const bg = getScoreBg(ll.scores.overall);
          const visible = hasReviewed
            ? ll.reviews
            : ll.reviews.slice(0, 1);
          const locked = !hasReviewed && ll.reviews.length > 1;
          return (
            <div
              style={{
                maxWidth: 720,
                margin: "0 auto",
                padding: "24px 20px",
              }}
            >
              <div
                style={{
                  border: "1px solid #e8ecf0",
                  borderRadius: 8,
                  background: "#fff",
                  marginBottom: 16,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "24px 28px",
                    borderBottom: "1px solid #e8ecf0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 16,
                    }}
                  >
                    <div>
                      <h1
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          margin: "0 0 4px",
                          color: "#1f2328",
                        }}
                      >
                        {ll.name}
                      </h1>
                      <p
                        style={{
                          fontSize: 14,
                          color: "#57606a",
                          margin: 0,
                        }}
                      >
                        {ll.neighborhood} · {ll.type}
                      </p>
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        padding: "12px 20px",
                        background: bg,
                        borderRadius: 8,
                        minWidth: 80,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: c,
                        }}
                      >
                        {ll.scores.overall.toFixed(1)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: c,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {getLabel(ll.scores.overall)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#8b949e",
                          marginTop: 2,
                        }}
                      >
                        {ll.reviewCount} reviews
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: "20px 28px" }}>
                  <h3
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1f2328",
                      margin: "0 0 14px",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Rating Breakdown
                  </h3>
                  <ScoreBar
                    label="Maintenance"
                    score={ll.scores.maintenance}
                  />
                  <ScoreBar
                    label="Communication"
                    score={ll.scores.communication}
                  />
                  <ScoreBar
                    label="Deposit Return"
                    score={ll.scores.deposit}
                  />
                  <ScoreBar
                    label="Listing Honesty"
                    score={ll.scores.honesty}
                  />
                </div>
              </div>
              <div
                style={{
                  border: "1px solid #e8ecf0",
                  borderRadius: 8,
                  background: "#fff",
                  padding: "20px 28px",
                  marginBottom: 16,
                }}
              >
                <h3
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1f2328",
                    margin: "0 0 16px",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Public Records
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 12,
                  }}
                >
                  {(() => {
                    const vCount = cityData.loading ? "--" : cityData.violationCount;
                    const cCount = cityData.loading ? "--" : cityData.complaintCount;
                    const vNum = typeof vCount === "number" ? vCount : 0;
                    const cNum = typeof cCount === "number" ? cCount : 0;
                    return [
                      [
                        vCount,
                        "Building Violations",
                        vNum > 5
                          ? "#cf222e"
                          : vNum > 0
                            ? "#bc4c00"
                            : "#1a7f37",
                      ],
                      [
                        cCount,
                        "311 Complaints",
                        cNum > 10
                          ? "#cf222e"
                          : cNum > 0
                            ? "#bc4c00"
                            : "#1a7f37",
                      ],
                      [ll.addresses.length, "Properties Listed", "#424a53"],
                    ] as const;
                  })().map(([num, label, color]) => (
                    <div
                      key={label}
                      style={{
                        padding: 14,
                        background: "#f6f8fa",
                        borderRadius: 6,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{ fontSize: 22, fontWeight: 700, color }}
                      >
                        {num}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#8b949e",
                          marginTop: 2,
                        }}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#8b949e",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Addresses on File
                  </div>
                  {ll.addresses.map((a) => (
                    <div
                      key={a}
                      style={{
                        fontSize: 13,
                        color: "#424a53",
                        padding: "3px 0",
                      }}
                    >
                      {a}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 11,
                    color: "#8b949e",
                  }}
                >
                  Source: City of Chicago Open Data Portal
                </div>
              </div>
              <CityRecords
                violations={cityData.violations}
                complaints={cityData.complaints}
                loading={cityData.loading}
                error={cityData.error}
                onRetry={cityData.retry}
              />
              <div
                style={{
                  border: "1px solid #e8ecf0",
                  borderRadius: 8,
                  background: "#fff",
                  padding: "20px 28px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1f2328",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Tenant Reviews ({ll.reviewCount})
                  </h3>
                  <button
                    onClick={goReview}
                    style={{
                      padding: "6px 14px",
                      background: "#fff",
                      border: "1px solid #d0d7de",
                      borderRadius: 6,
                      color: "#1f2328",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Write a Review
                  </button>
                </div>
                {visible.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
                {locked && (
                  <div style={{ position: "relative", marginTop: 8 }}>
                    <div
                      style={{
                        filter: "blur(5px)",
                        opacity: 0.35,
                        pointerEvents: "none",
                      }}
                    >
                      {ll.reviews.slice(1, 3).map((r) => (
                        <ReviewCard key={r.id + "-b"} review={r} />
                      ))}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(246,248,250,0.85)",
                        borderRadius: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#1f2328",
                          marginBottom: 6,
                        }}
                      >
                        {ll.reviews.length - 1} more reviews available
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#57606a",
                          marginBottom: 16,
                          textAlign: "center",
                          maxWidth: 320,
                        }}
                      >
                        Leave a review of your own landlord to unlock all
                        reviews on TenantShield.
                      </div>
                      <button
                        onClick={goReview}
                        style={{
                          padding: "10px 22px",
                          background: "#1f6feb",
                          border: "none",
                          borderRadius: 6,
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Write a Review to Unlock
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* ─── ADDRESS PROFILE ─── */}
      {view === "address-profile" && addressResult && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
          {/* Header */}
          <div
            style={{
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              background: "#fff",
              marginBottom: 16,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "24px 28px", borderBottom: "1px solid #e8ecf0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "#1f2328" }}>
                    {addressResult.address}
                  </h1>
                  <p style={{ fontSize: 14, color: "#57606a", margin: 0 }}>
                    Chicago, IL · Public Records
                  </p>
                </div>
                <div style={{
                  padding: "8px 14px",
                  background: "#f6f8fa",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#57606a",
                  fontWeight: 600,
                  textAlign: "center",
                }}>
                  City of Chicago<br />Open Data
                </div>
              </div>
            </div>
            <div style={{ padding: "20px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {(() => {
                  const vLen = addressResult.violations.length;
                  const cLen = addressResult.complaints.length;
                  return [
                    [cLen, "311 Complaints", cLen > 10 ? "#cf222e" : cLen > 0 ? "#bc4c00" : "#1a7f37"],
                    [vLen, "Building Violations", vLen > 5 ? "#cf222e" : vLen > 0 ? "#bc4c00" : "#1a7f37"],
                    [0, "Tenant Reviews", "#8b949e"],
                  ] as const;
                })().map(([num, label, color]) => (
                  <div key={label} style={{ padding: 14, background: "#f6f8fa", borderRadius: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{num}</div>
                    <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 311 Complaints */}
          <div
            style={{
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              background: "#fff",
              padding: "20px 28px",
              marginBottom: 16,
            }}
          >
            <h3 style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#1f2328",
              margin: "0 0 16px",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}>
              311 Complaints ({addressResult.complaints.length})
            </h3>
            {addressResult.complaints.length === 0 ? (
              <p style={{ fontSize: 14, color: "#57606a" }}>No 311 complaints on record for this address.</p>
            ) : (
              <>
                {(showAllProfileComplaints ? addressResult.complaints : addressResult.complaints.slice(0, 10)).map((c, i, arr) => {
                  const isClosed = c.status?.toUpperCase() === "CLOSED" || c.status?.toUpperCase() === "COMPLETED";
                  return (
                    <div
                      key={c.sr_number || i}
                      style={{
                        borderBottom: i < arr.length - 1 ? "1px solid #f0f3f6" : "none",
                        padding: "16px 0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: isClosed ? "#1a7f37" : "#bc4c00",
                            flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2328" }}>
                            {c.sr_type || "Service Request"}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: isClosed ? "#dafbe1" : "#fff1e5",
                          color: isClosed ? "#1a7f37" : "#bc4c00",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}>
                          {isClosed ? "Resolved" : "Open"}
                        </span>
                      </div>
                      {c.owner_department && (
                        <div style={{ fontSize: 12, color: "#424a53", paddingLeft: 16, marginBottom: 4 }}>
                          Handled by: {c.owner_department}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "#8b949e", paddingLeft: 16, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        <span>Filed {c.created_date ? formatDate(c.created_date) : "date unknown"}</span>
                        {isClosed && c.closed_date && <span> · Closed {formatDate(c.closed_date)}</span>}
                        {c.sr_number && <span> · #{c.sr_number}</span>}
                        {c.ward && <span> · Ward {c.ward}</span>}
                      </div>
                    </div>
                  );
                })}
                {addressResult.complaints.length > 10 && (
                  <button
                    onClick={() => setShowAllProfileComplaints((p) => !p)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px 0",
                      background: "#f6f8fa",
                      border: "1px solid #e8ecf0",
                      borderRadius: 6,
                      color: "#1f6feb",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      marginTop: 8,
                    }}
                  >
                    {showAllProfileComplaints ? "Show less" : `Show all ${addressResult.complaints.length}`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Building Violations */}
          <div
            style={{
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              background: "#fff",
              padding: "20px 28px",
              marginBottom: 16,
            }}
          >
            <h3 style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#1f2328",
              margin: "0 0 16px",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}>
              Building Violations ({addressResult.violations.length})
            </h3>
            {addressResult.violations.length === 0 ? (
              <p style={{ fontSize: 14, color: "#57606a" }}>No building violations on record for this address.</p>
            ) : (
              <>
                {(showAllProfileViolations ? addressResult.violations : addressResult.violations.slice(0, 10)).map((v, i, arr) => {
                  const isOpen = v.violation_status?.toUpperCase() !== "COMPLIANT" && v.violation_status?.toUpperCase() !== "COMPLIED";
                  return (
                    <div
                      key={v.id || i}
                      style={{
                        borderBottom: i < arr.length - 1 ? "1px solid #f0f3f6" : "none",
                        padding: "16px 0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: isOpen ? "#cf222e" : "#1a7f37",
                            flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2328" }}>
                            {v.inspection_category || "Building Violation"}
                          </span>
                          {v.department_bureau && (
                            <span style={{ fontSize: 11, color: "#8b949e" }}>· {v.department_bureau}</span>
                          )}
                        </div>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: isOpen ? "#ffebe9" : "#dafbe1",
                          color: isOpen ? "#cf222e" : "#1a7f37",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}>
                          {isOpen ? "Open" : "Resolved"}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: "#424a53", lineHeight: 1.6, margin: "0 0 4px", paddingLeft: 16 }}>
                        {v.violation_description || "No description available"}
                      </p>
                      {v.violation_inspector_comments && v.violation_inspector_comments !== v.violation_description && (
                        <p style={{ fontSize: 12, color: "#57606a", lineHeight: 1.5, margin: "0 0 4px", paddingLeft: 16, fontStyle: "italic" }}>
                          Inspector notes: {v.violation_inspector_comments}
                        </p>
                      )}
                      {v.violation_ordinance && (
                        <p style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.5, margin: "0 0 4px", paddingLeft: 16 }}>
                          {v.violation_ordinance}
                        </p>
                      )}
                      <div style={{ fontSize: 12, color: "#8b949e", paddingLeft: 16, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        <span>{v.violation_date ? formatDate(v.violation_date) : "Date unknown"}</span>
                        {!isOpen && v.violation_status_date && <span> · Resolved {formatDate(v.violation_status_date)}</span>}
                        {v.violation_code && <span> · Code {v.violation_code}</span>}
                      </div>
                    </div>
                  );
                })}
                {addressResult.violations.length > 10 && (
                  <button
                    onClick={() => setShowAllProfileViolations((p) => !p)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px 0",
                      background: "#f6f8fa",
                      border: "1px solid #e8ecf0",
                      borderRadius: 6,
                      color: "#1f6feb",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      marginTop: 8,
                    }}
                  >
                    {showAllProfileViolations ? "Show less" : `Show all ${addressResult.violations.length}`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Review CTA */}
          <div
            style={{
              border: "2px solid #d4e4fb",
              borderRadius: 10,
              background: "linear-gradient(to bottom, #f0f6ff, #fff)",
              padding: "36px 28px",
              textAlign: "center",
            }}
          >
            <h3 style={{ fontSize: 19, fontWeight: 700, color: "#1f2328", margin: "0 0 8px" }}>
              Have you lived here?
            </h3>
            <p style={{ fontSize: 14, color: "#57606a", margin: "0 0 8px", lineHeight: 1.6 }}>
              Your experience helps other renters make informed decisions.
            </p>
            <p style={{ fontSize: 13, color: "#8b949e", margin: "0 0 20px", lineHeight: 1.5 }}>
              City records only tell part of the story. Share what it was actually like — maintenance response times, deposit fairness, communication, and more.
            </p>
            <button
              onClick={goReview}
              style={{
                padding: "14px 36px",
                background: "#1f6feb",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 2px 8px rgba(31,111,235,0.3)",
              }}
            >
              Write a Review
            </button>
          </div>
        </div>
      )}

      {/* ─── REVIEW ─── */}
      {view === "review" &&
        (submitted ? (
          <div
            style={{
              maxWidth: 480,
              margin: "0 auto",
              padding: "60px 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                border: "1px solid #e8ecf0",
                borderRadius: 8,
                background: "#fff",
                padding: 36,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1a7f37",
                  background: "#dafbe1",
                  display: "inline-block",
                  padding: "6px 14px",
                  borderRadius: 20,
                  marginBottom: 16,
                }}
              >
                Review submitted
              </div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#1f2328",
                  margin: "0 0 8px",
                }}
              >
                Thank you for helping other renters.
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#57606a",
                  margin: "0 0 24px",
                  lineHeight: 1.6,
                }}
              >
                All reviews on TenantShield are now unlocked for you.
              </p>
              <button
                onClick={() => setView(selected ? "profile" : "home")}
                style={{
                  padding: "10px 24px",
                  background: "#1f6feb",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              >
                {selected ? "Back to Landlord Profile" : "Start Searching"}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              maxWidth: 540,
              margin: "0 auto",
              padding: "24px 20px",
            }}
          >
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#1f2328",
                margin: "0 0 4px",
              }}
            >
              Write a Review
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "#57606a",
                margin: "0 0 20px",
              }}
            >
              Your review helps other Chicago renters make better decisions.
            </p>
            <div
              style={{
                border: "1px solid #e8ecf0",
                borderRadius: 8,
                background: "#fff",
                padding: 24,
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1f2328",
                    marginBottom: 5,
                  }}
                >
                  Landlord or Property Manager *
                </label>
                <input
                  type="text"
                  value={form.landlordName}
                  onChange={(e) =>
                    setForm({ ...form, landlordName: e.target.value })
                  }
                  placeholder="e.g. Peak Properties"
                  style={inp}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1f2328",
                    marginBottom: 5,
                  }}
                >
                  Rental Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="e.g. 1234 N Clark St, Chicago, IL"
                  style={inp}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1f2328",
                    marginBottom: 10,
                  }}
                >
                  Ratings *
                </label>
                {(
                  [
                    ["maintenance", "Maintenance & Repairs"],
                    ["communication", "Communication"],
                    ["deposit", "Deposit Fairness"],
                    ["honesty", "Listing Honesty"],
                    ["overall", "Overall Experience"],
                  ] as const
                ).map(([k, l]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#424a53" }}>
                      {l}
                    </span>
                    <Stars
                      rating={form[k]}
                      interactive
                      onChange={(v) => setForm({ ...form, [k]: v })}
                      size={18}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1f2328",
                    marginBottom: 5,
                  }}
                >
                  Your Experience *
                </label>
                <textarea
                  value={form.text}
                  onChange={(e) =>
                    setForm({ ...form, text: e.target.value })
                  }
                  placeholder="What should the next tenant know? Be specific about maintenance, deposits, lease accuracy, or anything else that mattered."
                  rows={5}
                  style={{
                    ...inp,
                    resize: "vertical" as const,
                    lineHeight: 1.6,
                  }}
                />
              </div>
              <button
                onClick={submitReview}
                disabled={
                  !form.landlordName || !form.overall || !form.text
                }
                style={{
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor:
                    form.landlordName && form.overall && form.text
                      ? "pointer"
                      : "not-allowed",
                  fontFamily: "inherit",
                  background:
                    form.landlordName && form.overall && form.text
                      ? "#1f6feb"
                      : "#e8ecf0",
                  color:
                    form.landlordName && form.overall && form.text
                      ? "#fff"
                      : "#8b949e",
                }}
              >
                Submit Review
              </button>
            </div>
          </div>
        ))}

      {/* ─── LOGIN ─── */}
      {view === "login" && (
        <div
          style={{
            maxWidth: 380,
            margin: "0 auto",
            padding: "48px 20px 60px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1f6feb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: 14 }}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#1f2328",
                margin: "0 0 4px",
              }}
            >
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: "#8b949e", margin: 0 }}>
              Sign in to your TenantShield account
            </p>
          </div>
          <div
            style={{
              border: "1px solid #e8ecf0",
              borderRadius: 10,
              background: "#fff",
              padding: "28px 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            {auth.error && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#ffebe9",
                  border: "1px solid #ffcecb",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "#cf222e",
                  marginBottom: 16,
                }}
              >
                {auth.error}
              </div>
            )}
            <button
              onClick={() => {
                if (returnView) localStorage.setItem("tenantshield_returnView", returnView);
                auth.signInWithGoogle();
              }}
              style={{
                width: "100%",
                padding: "11px 0",
                background: "#fff",
                border: "1px solid #d0d7de",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                color: "#1f2328",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                transition: "background 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f6f8fa";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "20px 0",
              }}
            >
              <div style={{ flex: 1, height: 1, background: "#e8ecf0" }} />
              <span style={{ fontSize: 12, color: "#8b949e", fontWeight: 500 }}>or sign in with email</span>
              <div style={{ flex: 1, height: 1, background: "#e8ecf0" }} />
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await auth.signIn(loginEmail, loginPassword);
                if (ok) {
                  if (returnView) {
                    const rv = returnView;
                    setReturnView(null);
                    if (rv === "review") {
                      setForm({
                        landlordName: "",
                        address: "",
                        maintenance: 0,
                        communication: 0,
                        deposit: 0,
                        honesty: 0,
                        overall: 0,
                        text: "",
                      });
                      setSubmitted(false);
                    }
                    setView(rv);
                  } else {
                    goHome();
                  }
                }
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1f2328",
                    marginBottom: 5,
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ ...inp, borderRadius: 8 }}
                  required
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1f2328",
                    marginBottom: 5,
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Your password"
                  style={{ ...inp, borderRadius: 8 }}
                  required
                />
              </div>
              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "11px 0",
                  background: "#1f6feb",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1a5fd4")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#1f6feb")}
              >
                Log In
              </button>
            </form>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "#8b949e",
              textAlign: "center",
              marginTop: 20,
              marginBottom: 0,
            }}
          >
            Don&apos;t have an account?{" "}
            <span
              onClick={() => {
                auth.clearError();
                setSignupEmail("");
                setSignupPassword("");
                setSignupSuccess(false);
                setView("signup");
              }}
              style={{
                color: "#1f6feb",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Sign up
            </span>
          </p>
        </div>
      )}

      {/* ─── SIGNUP ─── */}
      {view === "signup" && (
        <div
          style={{
            maxWidth: 380,
            margin: "0 auto",
            padding: "48px 20px 60px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1f6feb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: 14 }}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#1f2328",
                margin: "0 0 4px",
              }}
            >
              Create your account
            </h2>
            <p style={{ fontSize: 14, color: "#8b949e", margin: 0 }}>
              Join TenantShield and help other renters
            </p>
          </div>
          <div
            style={{
              border: "1px solid #e8ecf0",
              borderRadius: 10,
              background: "#fff",
              padding: "28px 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            {signupSuccess ? (
              <div
                style={{
                  padding: "24px 16px",
                  background: "#dafbe1",
                  border: "1px solid #aceebb",
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: "#aceebb",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    fontSize: 20,
                  }}
                >
                  ✓
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#1a7f37",
                    marginBottom: 6,
                  }}
                >
                  Check your email
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "#1a7f37",
                    margin: "0 0 18px",
                    lineHeight: 1.5,
                  }}
                >
                  We sent a confirmation link to <strong>{signupEmail}</strong>. Click the link to activate your account, then log in to write your first review.
                </p>
                <span
                  onClick={() => {
                    auth.clearError();
                    setLoginEmail(signupEmail);
                    setLoginPassword("");
                    setView("login");
                  }}
                  style={{
                    color: "#1f6feb",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Go to Log In &rarr;
                </span>
              </div>
            ) : (
              <>
                {auth.error && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#ffebe9",
                      border: "1px solid #ffcecb",
                      borderRadius: 6,
                      fontSize: 13,
                      color: "#cf222e",
                      marginBottom: 16,
                    }}
                  >
                    {auth.error}
                  </div>
                )}
                <button
                  onClick={() => {
                    localStorage.setItem("tenantshield_returnView", returnView || "review");
                    auth.signInWithGoogle();
                  }}
                  style={{
                    width: "100%",
                    padding: "11px 0",
                    background: "#fff",
                    border: "1px solid #d0d7de",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: "#1f2328",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    transition: "background 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f6f8fa";
                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                  Continue with Google
                </button>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    margin: "20px 0",
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: "#e8ecf0" }} />
                  <span style={{ fontSize: 12, color: "#8b949e", fontWeight: 500 }}>or sign up with email</span>
                  <div style={{ flex: 1, height: 1, background: "#e8ecf0" }} />
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await auth.signUp(signupEmail, signupPassword);
                    if (ok) {
                      setSignupSuccess(true);
                      setReturnView("review");
                    }
                  }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#1f2328",
                        marginBottom: 5,
                      }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="you@example.com"
                      style={{ ...inp, borderRadius: 8 }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#1f2328",
                        marginBottom: 5,
                      }}
                    >
                      Password
                    </label>
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      style={{ ...inp, borderRadius: 8 }}
                      required
                      minLength={6}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      padding: "11px 0",
                      background: "#1f6feb",
                      border: "none",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1a5fd4")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#1f6feb")}
                  >
                    Create Account
                  </button>
                </form>
              </>
            )}
          </div>
          {!signupSuccess && (
            <p
              style={{
                fontSize: 13,
                color: "#8b949e",
                textAlign: "center",
                marginTop: 20,
                marginBottom: 0,
              }}
            >
              Already have an account?{" "}
              <span
                onClick={() => {
                  auth.clearError();
                  setLoginEmail("");
                  setLoginPassword("");
                  setView("login");
                }}
                style={{
                  color: "#1f6feb",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Log in
              </span>
            </p>
          )}
        </div>
      )}

      {/* ─── ACCOUNT ─── */}
      {view === "account" && auth.user && (
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            padding: "24px 20px",
          }}
        >
          <div
            style={{
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              background: "#fff",
              padding: "24px 28px",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#1f2328",
                margin: "0 0 12px",
              }}
            >
              Your Account
            </h2>
            <div style={{ fontSize: 14, color: "#424a53", marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Email:</span> {auth.user.email}
            </div>
            <div style={{ fontSize: 13, color: "#8b949e" }}>
              Member since{" "}
              {new Date(auth.user.created_at).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e8ecf0",
              borderRadius: 8,
              background: "#fff",
              padding: "20px 28px",
            }}
          >
            <h3
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1f2328",
                margin: "0 0 16px",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Your Reviews ({userReviews.length})
            </h3>
            {userReviews.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "36px 20px",
                }}
              >
                <p
                  style={{
                    fontSize: 15,
                    color: "#57606a",
                    marginBottom: 16,
                  }}
                >
                  You haven&apos;t written any reviews yet.
                </p>
                <button
                  onClick={goReview}
                  style={{
                    padding: "10px 22px",
                    background: "#1f6feb",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Write Your First Review
                </button>
              </div>
            ) : (
              userReviews.map((ur) => (
                <div key={ur.review.id}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1f6feb",
                      paddingTop: 12,
                    }}
                  >
                    {ur.landlordName}
                  </div>
                  <ReviewCard review={ur.review} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── ADMIN DASHBOARD ─── */}
      {view === "admin" && isAdmin && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1f2328", margin: "0 0 4px" }}>
            Admin Dashboard
          </h1>
          <p style={{ fontSize: 14, color: "#8b949e", margin: "0 0 24px" }}>
            Site analytics and activity overview
          </p>

          {adminLoading || !adminData ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <span style={{ fontSize: 14, color: "#57606a" }}>Loading dashboard...</span>
            </div>
          ) : (
            <>
              {/* Overview cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Searches", value7d: adminData.searchCount7d, valueAll: adminData.searchCountAll, color: "#1f6feb" },
                  { label: "Page Views", value7d: adminData.pageViewCount7d, valueAll: adminData.pageViewCountAll, color: "#1a7f37" },
                  { label: "Total Reviews", value7d: adminData.totalReviews, valueAll: null, color: "#9a6700" },
                  { label: "Unique Reviewers", value7d: adminData.uniqueReviewers, valueAll: null, color: "#6e40c9" },
                  { label: "Total Signups", value7d: adminData.totalSignups, valueAll: null, color: "#cf222e" },
                ].map((card) => (
                  <div key={card.label} style={{ border: "1px solid #e8ecf0", borderRadius: 8, background: "#fff", padding: "20px 24px" }}>
                    <div style={{ fontSize: 12, color: "#8b949e", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>
                      {card.value7d}
                    </div>
                    {card.valueAll !== null && (
                      <div style={{ fontSize: 12, color: "#8b949e", marginTop: 4 }}>
                        Last 7 days · {card.valueAll} all time
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Two column panels */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                {/* Search Log */}
                <div style={{ border: "1px solid #e8ecf0", borderRadius: 8, background: "#fff", padding: "20px 24px", maxHeight: 480, overflowY: "auto" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#1f2328", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Search Log ({adminData.recentSearches.length})
                  </h3>
                  {adminData.recentSearches.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#8b949e" }}>No searches yet</p>
                  ) : (
                    adminData.recentSearches.map((s, i) => {
                      const hasResults = (s.resultCount !== undefined && s.resultCount > 0) || s.hasAddressResult;
                      const hasData = s.resultCount !== undefined;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < adminData.recentSearches.length - 1 ? "1px solid #f0f3f6" : "none" }}>
                          {hasData && (
                            <span style={{ fontSize: 12, flexShrink: 0 }}>
                              {hasResults ? "\u2705" : "\u274C"}
                            </span>
                          )}
                          <span style={{ fontSize: 13, color: "#1f2328", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.query}</span>
                          <span style={{ fontSize: 11, color: "#8b949e", whiteSpace: "nowrap", flexShrink: 0 }}>{formatDate(s.created_at)}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Popular Landlords */}
                <div style={{ border: "1px solid #e8ecf0", borderRadius: 8, background: "#fff", padding: "20px 24px" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#1f2328", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Popular Landlords
                  </h3>
                  {adminData.popularLandlords.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#8b949e" }}>No profile views yet</p>
                  ) : (
                    adminData.popularLandlords.map((l, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < adminData.popularLandlords.length - 1 ? "1px solid #f0f3f6" : "none" }}>
                        <span style={{ fontSize: 13, color: "#1f2328", fontWeight: 500 }}>{l.name}</span>
                        <span style={{ fontSize: 12, color: "#8b949e" }}>{l.views} views</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* All Reviews */}
              <div style={{ border: "1px solid #e8ecf0", borderRadius: 8, background: "#fff", padding: "20px 24px", marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "#1f2328", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  All Reviews ({adminData.recentReviews.length})
                </h3>
                {adminData.recentReviews.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#8b949e" }}>No reviews yet</p>
                ) : (
                  <>
                    {adminData.recentReviews.slice(adminReviewPage * 25, (adminReviewPage + 1) * 25).map((r, i) => (
                      <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #f0f3f6" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2328" }}>{r.landlord_name}</span>
                            <Stars rating={r.rating} size={12} />
                          </div>
                          <span style={{ fontSize: 11, color: "#8b949e" }}>{formatDate(r.created_at)}</span>
                        </div>
                        {r.address && (
                          <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 4 }}>{r.address}</div>
                        )}
                        <p style={{ fontSize: 13, color: "#57606a", margin: 0, lineHeight: 1.5 }}>
                          {r.text}
                        </p>
                      </div>
                    ))}
                    {adminData.recentReviews.length > 25 && (
                      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                        <button
                          disabled={adminReviewPage === 0}
                          onClick={() => setAdminReviewPage((p) => p - 1)}
                          style={{
                            padding: "6px 14px",
                            background: adminReviewPage === 0 ? "#f6f8fa" : "#fff",
                            border: "1px solid #e8ecf0",
                            borderRadius: 6,
                            color: adminReviewPage === 0 ? "#8b949e" : "#1f6feb",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: adminReviewPage === 0 ? "default" : "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Previous
                        </button>
                        <span style={{ fontSize: 12, color: "#57606a", padding: "6px 8px" }}>
                          Page {adminReviewPage + 1} of {Math.ceil(adminData.recentReviews.length / 25)}
                        </span>
                        <button
                          disabled={(adminReviewPage + 1) * 25 >= adminData.recentReviews.length}
                          onClick={() => setAdminReviewPage((p) => p + 1)}
                          style={{
                            padding: "6px 14px",
                            background: (adminReviewPage + 1) * 25 >= adminData.recentReviews.length ? "#f6f8fa" : "#fff",
                            border: "1px solid #e8ecf0",
                            borderRadius: 6,
                            color: (adminReviewPage + 1) * 25 >= adminData.recentReviews.length ? "#8b949e" : "#1f6feb",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: (adminReviewPage + 1) * 25 >= adminData.recentReviews.length ? "default" : "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Activity Feed */}
              <div style={{ border: "1px solid #e8ecf0", borderRadius: 8, background: "#fff", padding: "20px 24px" }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "#1f2328", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Activity Feed
                </h3>
                {adminData.activityFeed.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#8b949e" }}>No activity yet</p>
                ) : (
                  adminData.activityFeed.map((ev, i) => {
                    const typeColors: Record<string, string> = {
                      search: "#1f6feb",
                      page_view: "#1a7f37",
                      review_submit: "#9a6700",
                      login: "#6e40c9",
                    };
                    const color = typeColors[ev.event_type] || "#57606a";
                    let detail = "";
                    if (ev.event_type === "search") detail = `"${(ev.event_data as Record<string, unknown>).query || ""}"`;
                    else if (ev.event_type === "page_view") detail = `${(ev.event_data as Record<string, unknown>).view || ""}${(ev.event_data as Record<string, unknown>).landlord ? ` — ${(ev.event_data as Record<string, unknown>).landlord}` : ""}`;
                    else if (ev.event_type === "review_submit") detail = (ev.event_data as Record<string, unknown>).landlord as string || "";
                    else if (ev.event_type === "login") detail = (ev.event_data as Record<string, unknown>).method as string || "";
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < adminData.activityFeed.length - 1 ? "1px solid #f0f3f6" : "none" }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: color + "18",
                          color,
                          whiteSpace: "nowrap",
                          minWidth: 80,
                          textAlign: "center",
                        }}>
                          {ev.event_type.replace("_", " ")}
                        </span>
                        <span style={{ fontSize: 13, color: "#424a53", flex: 1 }}>{detail}</span>
                        <span style={{ fontSize: 11, color: "#8b949e", whiteSpace: "nowrap" }}>{formatDate(ev.created_at)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}

      <footer
        style={{
          textAlign: "center",
          padding: "36px 20px",
          borderTop: "1px solid #e8ecf0",
          marginTop: 40,
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 13, color: "#8b949e" }}>
          TenantShield · Protecting Chicago renters · 2026
        </div>
        <div style={{ fontSize: 11, color: "#b1bac4", marginTop: 4 }}>
          Public records sourced from the City of Chicago Open Data Portal
        </div>
      </footer>

      {showGate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 20,
          }}
          onClick={() => setShowGate(false)}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #e8ecf0",
              borderRadius: 10,
              padding: 32,
              maxWidth: 380,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: 17,
                fontWeight: 700,
                margin: "0 0 8px",
                color: "#1f2328",
              }}
            >
              Unlock all reviews
            </h3>
            <p
              style={{
                fontSize: 14,
                color: "#57606a",
                margin: "0 0 20px",
                lineHeight: 1.6,
              }}
            >
              Share your own rental experience to unlock every review on
              TenantShield.
            </p>
            <button
              onClick={goReview}
              style={{
                width: "100%",
                padding: "12px 0",
                background: "#1f6feb",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "inherit",
              }}
            >
              Write a Review
            </button>
            <button
              onClick={() => setShowGate(false)}
              style={{
                width: "100%",
                padding: "8px 0",
                background: "transparent",
                border: "none",
                color: "#8b949e",
                fontSize: 13,
                cursor: "pointer",
                marginTop: 6,
                fontFamily: "inherit",
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
