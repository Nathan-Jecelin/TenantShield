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

const DIRECTIONS: Record<string, string> = {
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
  NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW",
};

export function parseStreetAddress(full: string): string {
  let street = full.split(",")[0].trim().toUpperCase();
  // Remove periods (e.g. "St." → "ST")
  street = street.replace(/\./g, "");
  // Strip apartment/unit/suite suffixes
  street = street.replace(/\s+(APT|UNIT|STE|SUITE|#)\s*\S*$/i, "");
  // Normalize directional words
  street = street.replace(
    /\b(NORTH|SOUTH|EAST|WEST|NORTHEAST|NORTHWEST|SOUTHEAST|SOUTHWEST)\b/g,
    (m) => DIRECTIONS[m] || m
  );
  // Normalize all street type words (not just last word)
  for (const [full, abbr] of Object.entries(STREET_TYPES)) {
    street = street.replace(new RegExp(`\\b${full}\\b`, "g"), abbr);
  }
  return street.replace(/\s+/g, " ").trim();
}

export function generateAddressVariants(parsed: string): string[] {
  const variants = [parsed];
  // Try without directional prefix (e.g. "1550 LAKE SHORE DR")
  const withoutDir = parsed.replace(/^(\d+)\s+[NSEW]\s+/, "$1 ");
  if (withoutDir !== parsed) variants.push(withoutDir);
  return variants;
}

function buildOrClause(column: string, addresses: string[]): string {
  return addresses
    .map((a) => `starts_with(upper(${column}), '${a.replace(/'/g, "''")}')`)
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
