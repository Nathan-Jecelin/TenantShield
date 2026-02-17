// Chicago Open Data Portal API layer
// Building Violations: https://data.cityofchicago.org/resource/22u3-xenr.json
// 311 Service Requests: https://data.cityofchicago.org/resource/v6vf-nfxy.json

export interface BuildingViolation {
  id: string;
  violation_date: string;
  violation_status: string;
  violation_description: string;
  inspection_category: string;
  address: string;
}

export interface ServiceRequest {
  sr_number: string;
  sr_type: string;
  status: string;
  created_date: string;
  street_address: string;
}

const STREET_TYPES: Record<string, string> = {
  AVENUE: "AVE",
  BOULEVARD: "BLVD",
  CIRCLE: "CIR",
  COURT: "CT",
  DRIVE: "DR",
  EXPRESSWAY: "EXPY",
  HIGHWAY: "HWY",
  LANE: "LN",
  PARKWAY: "PKWY",
  PLACE: "PL",
  PLAZA: "PLZ",
  ROAD: "RD",
  SQUARE: "SQ",
  STREET: "ST",
  TERRACE: "TER",
  TRAIL: "TRL",
  WAY: "WAY",
};

export function parseStreetAddress(full: string): string {
  // Take only the street portion (before first comma), uppercase
  const street = full.split(",")[0].trim().toUpperCase();
  // Normalize street types
  return street.replace(/\b([A-Z]+)$/g, (match) => STREET_TYPES[match] || match);
}

function buildOrClause(column: string, addresses: string[]): string {
  return addresses
    .map((a) => `${column}='${a.replace(/'/g, "''")}'`)
    .join(" OR ");
}

const VIOLATION_FIELDS =
  "id,violation_date,violation_status,violation_description,inspection_category,address";

export async function fetchBuildingViolations(
  streetAddresses: string[]
): Promise<BuildingViolation[]> {
  if (streetAddresses.length === 0) return [];
  const where = buildOrClause("address", streetAddresses);
  const params = new URLSearchParams({
    $where: where,
    $order: "violation_date DESC",
    $limit: "200",
    $select: VIOLATION_FIELDS,
  });
  const res = await fetch(
    `https://data.cityofchicago.org/resource/22u3-xenr.json?${params}`
  );
  if (!res.ok) throw new Error(`Violations API error: ${res.status}`);
  return res.json();
}

const SR_FIELDS = "sr_number,sr_type,status,created_date,street_address";

export async function fetchServiceRequests(
  streetAddresses: string[]
): Promise<ServiceRequest[]> {
  if (streetAddresses.length === 0) return [];
  const where = buildOrClause("street_address", streetAddresses);
  const params = new URLSearchParams({
    $where: where,
    $order: "created_date DESC",
    $limit: "200",
    $select: SR_FIELDS,
  });
  const res = await fetch(
    `https://data.cityofchicago.org/resource/v6vf-nfxy.json?${params}`
  );
  if (!res.ok) throw new Error(`311 API error: ${res.status}`);
  return res.json();
}
