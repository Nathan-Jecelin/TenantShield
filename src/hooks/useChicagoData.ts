import { useState, useEffect, useRef, useCallback } from "react";
import {
  BuildingViolation,
  ServiceRequest,
  parseStreetAddress,
  fetchBuildingViolations,
  fetchServiceRequests,
} from "@/lib/chicagoData";

export interface ChicagoData {
  violations: BuildingViolation[];
  complaints: ServiceRequest[];
  violationCount: number;
  complaintCount: number;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export interface LandlordCounts {
  violations: number;
  complaints: number;
}

export interface ChicagoResultsCounts {
  counts: Record<string, LandlordCounts>;
  loading: boolean;
}

export function useChicagoResultsCounts(
  landlords: { id: string; addresses: string[] }[] | null
): ChicagoResultsCounts {
  const [counts, setCounts] = useState<Record<string, LandlordCounts>>({});
  const [loading, setLoading] = useState(false);
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (!landlords || landlords.length === 0) {
      setCounts({});
      lastKey.current = "";
      return;
    }
    const key = landlords.map((l) => l.id).sort().join("|");
    if (key === lastKey.current) return;
    lastKey.current = key;

    // Build address-to-landlord mapping
    const addrToLandlord: Record<string, string[]> = {};
    for (const ll of landlords) {
      for (const raw of ll.addresses) {
        const parsed = parseStreetAddress(raw);
        if (!addrToLandlord[parsed]) addrToLandlord[parsed] = [];
        addrToLandlord[parsed].push(ll.id);
      }
    }
    const allParsed = Object.keys(addrToLandlord);

    setLoading(true);
    Promise.all([
      fetchBuildingViolations(allParsed),
      fetchServiceRequests(allParsed),
    ])
      .then(([violations, complaints]) => {
        const result: Record<string, LandlordCounts> = {};
        for (const ll of landlords) {
          result[ll.id] = { violations: 0, complaints: 0 };
        }
        for (const v of violations) {
          const ids = addrToLandlord[v.address?.toUpperCase()] || [];
          for (const id of ids) result[id].violations++;
        }
        for (const c of complaints) {
          const ids = addrToLandlord[c.street_address?.toUpperCase()] || [];
          for (const id of ids) result[id].complaints++;
        }
        setCounts(result);
      })
      .catch(() => {
        // Silently fail for results view — profile view has full error handling
      })
      .finally(() => setLoading(false));
  }, [landlords]);

  return { counts, loading };
}

export function useChicagoData(addresses: string[] | null): ChicagoData {
  const [violations, setViolations] = useState<BuildingViolation[]>([]);
  const [complaints, setComplaints] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKey = useRef<string>("");

  const doFetch = useCallback(async (addrs: string[]) => {
    const parsed = addrs.map(parseStreetAddress);
    setLoading(true);
    setError(null);
    try {
      const [v, c] = await Promise.all([
        fetchBuildingViolations(parsed),
        fetchServiceRequests(parsed),
      ]);
      setViolations(v);
      setComplaints(c);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load city records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!addresses || addresses.length === 0) {
      setViolations([]);
      setComplaints([]);
      setError(null);
      lastKey.current = "";
      return;
    }
    const key = addresses.slice().sort().join("|");
    if (key === lastKey.current) return;
    lastKey.current = key;
    doFetch(addresses);
  }, [addresses, doFetch]);

  return {
    violations,
    complaints,
    violationCount: violations.length,
    complaintCount: complaints.length,
    loading,
    error,
    retry: () => {
      if (addresses) {
        lastKey.current = "";
        doFetch(addresses);
      }
    },
  };
}
