"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { useChicagoData, useChicagoResultsCounts } from "@/hooks/useChicagoData";
import { useAuth } from "@/hooks/useAuth";
import CityRecords from "@/components/CityRecords";

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

const SEED_LANDLORDS: Landlord[] = [
  {
    id: "ll-001", slug: "ll-001", name: "Greystar Property Management",
    addresses: ["1550 N Lake Shore Dr, Chicago, IL 60610", "2800 N Lake Shore Dr, Chicago, IL 60657"],
    neighborhood: "Gold Coast / Lakeview", type: "Property Management Company",
    scores: { maintenance: 2.1, communication: 1.8, deposit: 2.5, honesty: 1.9, overall: 2.1 },
    reviewCount: 47, violations: 12, complaints: 23,
    reviews: [
      { id: "r1", author: "Former Tenant", date: "Nov 14, 2025", rating: 2, text: "Maintenance requests took 3+ weeks to address. The heating went out in January and they told me to 'use a space heater.' Security deposit was returned minus bogus charges for 'deep cleaning' despite leaving the unit spotless.", helpful: 34 },
      { id: "r2", author: "Verified Renter", date: "Sep 22, 2025", rating: 1, text: "Listing showed renovated kitchen with new appliances. Moved in to find the same 1990s setup with a broken dishwasher. When I complained, they said the photos were from a 'model unit.' Total bait and switch.", helpful: 51 },
      { id: "r3", author: "Anonymous Tenant", date: "Jul 3, 2025", rating: 3, text: "Location is great and the building itself is fine. Management is just slow and unresponsive. If nothing breaks, you're golden. The moment you need something fixed, good luck.", helpful: 18 },
    ],
  },
  {
    id: "ll-002", slug: "ll-002", name: "Lincoln Property Company",
    addresses: ["225 N Columbus Dr, Chicago, IL 60601", "500 W Superior St, Chicago, IL 60654"],
    neighborhood: "Streeterville / River North", type: "Property Management Company",
    scores: { maintenance: 3.8, communication: 4.1, deposit: 3.5, honesty: 4.0, overall: 3.9 },
    reviewCount: 31, violations: 2, complaints: 5,
    reviews: [
      { id: "r4", author: "Current Tenant", date: "Dec 1, 2025", rating: 4, text: "Pretty responsive management. Put in a work order for a leaky faucet and it was fixed the next day. Building amenities are well maintained. Only downside is the rent increases each year have been aggressive.", helpful: 22 },
      { id: "r5", author: "Former Tenant", date: "Aug 15, 2025", rating: 4, text: "Good experience overall. Got my full deposit back within 30 days. The building was clean and well-managed. Would rent from them again.", helpful: 15 },
    ],
  },
  {
    id: "ll-003", slug: "ll-003", name: "Peak Properties",
    addresses: ["3121 N Broadway, Chicago, IL 60657", "1415 W Diversey Pkwy, Chicago, IL 60614", "2644 N Ashland Ave, Chicago, IL 60614"],
    neighborhood: "Lakeview / Lincoln Park", type: "Property Management Company",
    scores: { maintenance: 1.5, communication: 1.2, deposit: 1.0, honesty: 1.3, overall: 1.2 },
    reviewCount: 89, violations: 34, complaints: 56,
    reviews: [
      { id: "r6", author: "Verified Renter", date: "Jan 10, 2026", rating: 1, text: "DO NOT RENT FROM PEAK. They will find every excuse to keep your deposit. I documented the apartment condition with photos at move-in and move-out, and they still charged me $800 for 'damages' that were pre-existing. Had to threaten legal action to get any money back.", helpful: 89 },
      { id: "r7", author: "Former Tenant", date: "Oct 28, 2025", rating: 1, text: "Roach infestation that they refused to properly treat for 4 months. They sent a guy with a can of Raid instead of a real exterminator. Multiple neighbors had the same issue. Also the laundry machines were broken for 6 weeks.", helpful: 67 },
      { id: "r8", author: "Anonymous Tenant", date: "Jun 19, 2025", rating: 2, text: "They seem friendly at first but once you sign the lease, they become completely unresponsive. I called about a broken A/C in July and didn't get it fixed until September. By then, summer was over.", helpful: 41 },
    ],
  },
  {
    id: "ll-004", slug: "ll-004", name: "Beal Properties",
    addresses: ["5050 N Sheridan Rd, Chicago, IL 60640", "4840 N Marine Dr, Chicago, IL 60640"],
    neighborhood: "Uptown / Edgewater", type: "Property Management Company",
    scores: { maintenance: 4.2, communication: 4.5, deposit: 4.7, honesty: 4.3, overall: 4.4 },
    reviewCount: 22, violations: 0, complaints: 1,
    reviews: [
      { id: "r9", author: "Current Tenant", date: "Nov 30, 2025", rating: 5, text: "Honestly the best landlord I've had in Chicago. Maintenance requests are handled same-day. They actually care about the building. Rent is fair for the area. Full deposit returned promptly.", helpful: 28 },
      { id: "r10", author: "Former Tenant", date: "May 12, 2025", rating: 4, text: "Very solid property management. Building was always clean, they communicated well about any building work, and the lease terms were straightforward with no hidden fees. Would recommend.", helpful: 19 },
    ],
  },
  {
    id: "ll-005", slug: "ll-005", name: "Planned Property Management",
    addresses: ["2936 N Clark St, Chicago, IL 60657", "1639 W Fullerton Ave, Chicago, IL 60614"],
    neighborhood: "Lakeview / DePaul Area", type: "Property Management Company",
    scores: { maintenance: 2.8, communication: 2.5, deposit: 2.0, honesty: 2.7, overall: 2.5 },
    reviewCount: 53, violations: 8, complaints: 19,
    reviews: [
      { id: "r11", author: "Verified Renter", date: "Dec 20, 2025", rating: 2, text: "Mixed experience. The apartment itself was nice but the management nickel-and-dimes you on everything. Charged me for 'new blinds' that were already broken when I moved in. Hard to get anyone on the phone.", helpful: 31 },
      { id: "r12", author: "Anonymous Tenant", date: "Sep 5, 2025", rating: 3, text: "Average for Chicago. Not the worst, not the best. Maintenance is slow but they do eventually get to it. Just document everything and you'll be fine.", helpful: 12 },
    ],
  },
  {
    id: "ll-006", slug: "ll-006", name: "MCZ Development",
    addresses: ["1460 N Sandburg Terrace, Chicago, IL 60610"],
    neighborhood: "Near North Side", type: "Developer / Manager",
    scores: { maintenance: 3.5, communication: 3.2, deposit: 3.8, honesty: 3.6, overall: 3.5 },
    reviewCount: 15, violations: 3, complaints: 7,
    reviews: [
      { id: "r13", author: "Current Tenant", date: "Oct 10, 2025", rating: 4, text: "Decent building, good location. Maintenance could be faster but they're generally fair. Got most of my deposit back. No major complaints.", helpful: 8 },
    ],
  },
];

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

  const auth = useAuth();

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

  const doSearch = useCallback(
    async (q?: string) => {
      const t = (q || query).toLowerCase().trim();
      if (!t) return;

      if (isSupabaseConfigured()) {
        setLoading(true);
        const found = await searchLandlords(t);
        setResults(found);
        setLoading(false);
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
        setResults(f);
      }
      setView("results");
    },
    [query, landlords]
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
              if (view === "profile") setView("results");
              else if (view === "review" && selected) setView("profile");
              else if (view === "login" || view === "signup" || view === "account") goHome();
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
              display: "flex",
              justifyContent: "center",
              gap: 48,
              padding: "32px 20px",
              borderBottom: "1px solid #e8ecf0",
              flexWrap: "wrap",
            }}
          >
            {(
              [
                ["257", "Tenant Reviews"],
                ["6", "Landlords Tracked"],
                ["12", "Neighborhoods"],
                ["87", "Violations on Record"],
              ] as const
            ).map(([n, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 24, fontWeight: 700, color: "#1f2328" }}
                >
                  {n}
                </div>
                <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2 }}>
                  {l}
                </div>
              </div>
            ))}
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
            {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;
            {query}&rdquo;
          </p>
          {results.length === 0 && (
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
                No landlords found matching your search.
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
                  We sent a confirmation link to <strong>{signupEmail}</strong>. Click the link to activate your account.
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
                  Go to Log In
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
                  <span style={{ fontSize: 12, color: "#8b949e", fontWeight: 500 }}>or sign up with email</span>
                  <div style={{ flex: 1, height: 1, background: "#e8ecf0" }} />
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await auth.signUp(signupEmail, signupPassword);
                    if (ok) setSignupSuccess(true);
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
