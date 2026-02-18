// Chicago Open Data Portal API layer
// Building Violations: https://data.cityofchicago.org/resource/22u3-xenr.json
// 311 Service Requests: https://data.cityofchicago.org/resource/v6vf-nfxy.json

export interface BuildingViolation {
  id: string;
  violation_date: string;
  violation_status: string;
  violation_status_date: string;
  violation_description: string;
  violation_inspector_comments: string;
  violation_ordinance: string;
  violation_code: string;
  inspection_category: string;
  inspection_status: string;
  department_bureau: string;
  address: string;
}

export interface ServiceRequest {
  sr_number: string;
  sr_type: string;
  status: string;
  created_date: string;
  closed_date: string;
  owner_department: string;
  ward: string;
  zip_code: string;
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
  "id,violation_date,violation_status,violation_status_date,violation_description,violation_inspector_comments,violation_ordinance,violation_code,inspection_category,inspection_status,department_bureau,address";

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

const SR_FIELDS = "sr_number,sr_type,status,created_date,closed_date,owner_department,ward,zip_code,street_address";

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

// ─── NEIGHBORHOOD / COMMUNITY AREA SUPPORT ───

// Chicago community area numbers mapped from common neighborhood names
// See: https://en.wikipedia.org/wiki/Community_areas_in_Chicago
const NEIGHBORHOOD_TO_COMMUNITY_AREA: Record<string, { id: string; name: string }> = {
  "rogers park": { id: "1", name: "Rogers Park" },
  "west ridge": { id: "2", name: "West Ridge" },
  "uptown": { id: "3", name: "Uptown" },
  "lincoln square": { id: "4", name: "Lincoln Square" },
  "north center": { id: "5", name: "North Center" },
  "lake view": { id: "6", name: "Lake View" },
  "lakeview": { id: "6", name: "Lake View" },
  "lincoln park": { id: "7", name: "Lincoln Park" },
  "near north side": { id: "8", name: "Near North Side" },
  "gold coast": { id: "8", name: "Near North Side" },
  "edison park": { id: "9", name: "Edison Park" },
  "norwood park": { id: "10", name: "Norwood Park" },
  "jefferson park": { id: "11", name: "Jefferson Park" },
  "forest glen": { id: "12", name: "Forest Glen" },
  "north park": { id: "13", name: "North Park" },
  "albany park": { id: "14", name: "Albany Park" },
  "portage park": { id: "15", name: "Portage Park" },
  "irving park": { id: "16", name: "Irving Park" },
  "dunning": { id: "17", name: "Dunning" },
  "montclare": { id: "18", name: "Montclare" },
  "belmont cragin": { id: "19", name: "Belmont Cragin" },
  "hermosa": { id: "20", name: "Hermosa" },
  "avondale": { id: "21", name: "Avondale" },
  "logan square": { id: "22", name: "Logan Square" },
  "humboldt park": { id: "23", name: "Humboldt Park" },
  "west town": { id: "24", name: "West Town" },
  "wicker park": { id: "24", name: "West Town" },
  "bucktown": { id: "24", name: "West Town" },
  "austin": { id: "25", name: "Austin" },
  "west garfield park": { id: "26", name: "West Garfield Park" },
  "east garfield park": { id: "27", name: "East Garfield Park" },
  "near west side": { id: "28", name: "Near West Side" },
  "north lawndale": { id: "29", name: "North Lawndale" },
  "south lawndale": { id: "30", name: "South Lawndale" },
  "little village": { id: "30", name: "South Lawndale" },
  "lower west side": { id: "31", name: "Lower West Side" },
  "pilsen": { id: "31", name: "Lower West Side" },
  "loop": { id: "32", name: "Loop" },
  "the loop": { id: "32", name: "Loop" },
  "near south side": { id: "33", name: "Near South Side" },
  "south loop": { id: "33", name: "Near South Side" },
  "armour square": { id: "34", name: "Armour Square" },
  "chinatown": { id: "34", name: "Armour Square" },
  "douglas": { id: "35", name: "Douglas" },
  "bronzeville": { id: "35", name: "Douglas" },
  "oakland": { id: "36", name: "Oakland" },
  "fuller park": { id: "37", name: "Fuller Park" },
  "grand boulevard": { id: "38", name: "Grand Boulevard" },
  "kenwood": { id: "39", name: "Kenwood" },
  "washington park": { id: "40", name: "Washington Park" },
  "hyde park": { id: "41", name: "Hyde Park" },
  "woodlawn": { id: "42", name: "Woodlawn" },
  "south shore": { id: "43", name: "South Shore" },
  "chatham": { id: "44", name: "Chatham" },
  "avalon park": { id: "45", name: "Avalon Park" },
  "south chicago": { id: "46", name: "South Chicago" },
  "burnside": { id: "47", name: "Burnside" },
  "calumet heights": { id: "48", name: "Calumet Heights" },
  "roseland": { id: "49", name: "Roseland" },
  "pullman": { id: "50", name: "Pullman" },
  "south deering": { id: "51", name: "South Deering" },
  "east side": { id: "52", name: "East Side" },
  "west pullman": { id: "53", name: "West Pullman" },
  "riverdale": { id: "54", name: "Riverdale" },
  "hegewisch": { id: "55", name: "Hegewisch" },
  "garfield ridge": { id: "56", name: "Garfield Ridge" },
  "archer heights": { id: "57", name: "Archer Heights" },
  "brighton park": { id: "58", name: "Brighton Park" },
  "mckinley park": { id: "59", name: "McKinley Park" },
  "bridgeport": { id: "60", name: "Bridgeport" },
  "new city": { id: "61", name: "New City" },
  "back of the yards": { id: "61", name: "New City" },
  "west elsdon": { id: "62", name: "West Elsdon" },
  "gage park": { id: "63", name: "Gage Park" },
  "clearing": { id: "64", name: "Clearing" },
  "west lawn": { id: "65", name: "West Lawn" },
  "chicago lawn": { id: "66", name: "Chicago Lawn" },
  "west englewood": { id: "67", name: "West Englewood" },
  "englewood": { id: "68", name: "Englewood" },
  "greater grand crossing": { id: "69", name: "Greater Grand Crossing" },
  "ashburn": { id: "70", name: "Ashburn" },
  "auburn gresham": { id: "71", name: "Auburn Gresham" },
  "beverly": { id: "72", name: "Beverly" },
  "washington heights": { id: "73", name: "Washington Heights" },
  "mount greenwood": { id: "74", name: "Mount Greenwood" },
  "morgan park": { id: "75", name: "Morgan Park" },
  "ohare": { id: "76", name: "O'Hare" },
  "o'hare": { id: "76", name: "O'Hare" },
  "edgewater": { id: "77", name: "Edgewater" },
  "andersonville": { id: "77", name: "Edgewater" },
};

export interface NeighborhoodResult {
  communityArea: string;
  neighborhoodName: string;
  topAddresses: {
    address: string;
    complaintCount: number;
    violationCount: number;
  }[];
  totalComplaints: number;
  totalViolations: number;
  recentComplaints: ServiceRequest[];
  recentViolations: BuildingViolation[];
}

/**
 * Check if a search term matches a known Chicago neighborhood.
 * Returns the community area info or null.
 */
export function matchNeighborhood(query: string): { id: string; name: string } | null {
  return NEIGHBORHOOD_TO_COMMUNITY_AREA[query.toLowerCase().trim()] || null;
}

/**
 * Fetch neighborhood-level data: top addresses by complaint volume,
 * plus recent complaints and violations for those addresses.
 */
export async function fetchNeighborhoodData(
  communityAreaId: string
): Promise<{ topAddresses: { address: string; count: number }[]; complaints: ServiceRequest[] }> {
  // Get recent 311 complaints for this community area
  const params = new URLSearchParams({
    $where: `community_area='${communityAreaId}'`,
    $order: "created_date DESC",
    $limit: "200",
    $select: SR_FIELDS + ",community_area",
  });
  const res = await fetch(
    `https://data.cityofchicago.org/resource/v6vf-nfxy.json?${params}`
  );
  if (!res.ok) throw new Error(`311 API error: ${res.status}`);
  const complaints: (ServiceRequest & { community_area: string })[] = await res.json();

  // Aggregate top addresses by complaint count
  const addrCounts: Record<string, number> = {};
  for (const c of complaints) {
    if (c.street_address) {
      addrCounts[c.street_address] = (addrCounts[c.street_address] || 0) + 1;
    }
  }
  const topAddresses = Object.entries(addrCounts)
    .map(([address, count]) => ({ address, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { topAddresses, complaints };
}

/**
 * Full neighborhood search: gets complaints by community area,
 * finds top addresses, then fetches violations for those addresses.
 */
export async function fetchFullNeighborhoodData(
  communityAreaId: string,
  neighborhoodName: string
): Promise<NeighborhoodResult> {
  const { topAddresses, complaints } = await fetchNeighborhoodData(communityAreaId);

  // Fetch violations for the top addresses
  const topAddrStrings = topAddresses.map((a) => a.address);
  let violations: BuildingViolation[] = [];
  if (topAddrStrings.length > 0) {
    // Query violations using exact match for the top addresses (they're already normalized from the API)
    const where = topAddrStrings
      .map((a) => `address='${a.replace(/'/g, "''")}'`)
      .join(" OR ");
    const vParams = new URLSearchParams({
      $where: where,
      $order: "violation_date DESC",
      $limit: "200",
      $select: VIOLATION_FIELDS,
    });
    const vRes = await fetch(
      `https://data.cityofchicago.org/resource/22u3-xenr.json?${vParams}`
    );
    if (vRes.ok) {
      violations = await vRes.json();
    }
  }

  // Count violations per address
  const violationCounts: Record<string, number> = {};
  for (const v of violations) {
    if (v.address) {
      violationCounts[v.address] = (violationCounts[v.address] || 0) + 1;
    }
  }

  return {
    communityArea: communityAreaId,
    neighborhoodName,
    topAddresses: topAddresses.map((a) => ({
      address: a.address,
      complaintCount: a.count,
      violationCount: violationCounts[a.address] || 0,
    })),
    totalComplaints: complaints.length,
    totalViolations: violations.length,
    recentComplaints: complaints.slice(0, 50),
    recentViolations: violations.slice(0, 50),
  };
}
