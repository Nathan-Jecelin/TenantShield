/**
 * Convert a street address to a URL slug.
 * "1550 N Lake Shore Dr" → "1550-n-lake-shore-dr"
 */
export function addressToSlug(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Convert a URL slug back to a display address.
 * "1550-n-lake-shore-dr" → "1550 N Lake Shore Dr"
 */
export function slugToAddress(slug: string): string {
  const STREET_ABBREVS: Record<string, string> = {
    st: "St",
    ave: "Ave",
    blvd: "Blvd",
    dr: "Dr",
    ct: "Ct",
    pl: "Pl",
    rd: "Rd",
    ln: "Ln",
    pkwy: "Pkwy",
    cir: "Cir",
    ter: "Ter",
    way: "Way",
    hwy: "Hwy",
    expy: "Expy",
    sq: "Sq",
    plz: "Plz",
    trl: "Trl",
  };

  const DIRECTIONALS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);

  return slug
    .split("-")
    .map((word) => {
      if (!word) return "";
      if (DIRECTIONALS.has(word)) return word.toUpperCase();
      if (STREET_ABBREVS[word]) return STREET_ABBREVS[word];
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
