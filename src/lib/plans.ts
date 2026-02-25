export type Feature =
  | 'view_violations'
  | 'view_complaints'
  | 'building_score'
  | 'claim_building'
  | 'alerts'
  | 'respond'
  | 'verified_badge'
  | 'benchmarks';

const FREE_FEATURES = new Set<Feature>([
  'view_violations',
  'view_complaints',
  'building_score',
  'claim_building',
]);

const PRO_FEATURES = new Set<Feature>([
  ...FREE_FEATURES,
  'alerts',
  'respond',
  'verified_badge',
  'benchmarks',
]);

export function canAccess(feature: Feature, plan: string): boolean {
  if (plan === 'pro') return PRO_FEATURES.has(feature);
  return FREE_FEATURES.has(feature);
}

export const MAX_FREE_BUILDINGS = 1;
