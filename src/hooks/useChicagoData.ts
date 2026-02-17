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
