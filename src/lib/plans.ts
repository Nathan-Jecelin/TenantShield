export type Feature =
  | 'view_violations'
  | 'view_complaints'
  | 'building_score'
  | 'claim_building'
  | 'alerts'
  | 'respond'
  | 'verified_badge'
  | 'benchmarks'
  | 'priority_support'
  | 'api_access'
  | 'custom_branding';

export type PlanId = 'free' | 'professional' | 'portfolio' | 'enterprise';

export interface PlanConfig {
  id: PlanId;
  name: string;
  price: number;
  stripePriceId: string | null;
  maxBuildings: number;
  features: Set<Feature>;
  description: string;
}

const FREE_FEATURES = new Set<Feature>([
  'view_violations',
  'view_complaints',
  'building_score',
  'claim_building',
]);

const PROFESSIONAL_FEATURES = new Set<Feature>([
  ...FREE_FEATURES,
  'alerts',
  'respond',
  'verified_badge',
]);

const PORTFOLIO_FEATURES = new Set<Feature>([
  ...PROFESSIONAL_FEATURES,
  'benchmarks',
  'priority_support',
]);

const ENTERPRISE_FEATURES = new Set<Feature>([
  ...PORTFOLIO_FEATURES,
  'api_access',
  'custom_branding',
]);

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    stripePriceId: null,
    maxBuildings: 1,
    features: FREE_FEATURES,
    description: '1 building, basic data access',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 39,
    stripePriceId: 'price_1T9XR02Vqta5JLGPBVworW5E',
    maxBuildings: 5,
    features: PROFESSIONAL_FEATURES,
    description: 'Up to 5 buildings, alerts & responses',
  },
  portfolio: {
    id: 'portfolio',
    name: 'Portfolio',
    price: 99,
    stripePriceId: 'price_1T9XRK2Vqta5JLGPtaflXkby',
    maxBuildings: 25,
    features: PORTFOLIO_FEATURES,
    description: 'Up to 25 buildings, benchmarks & priority support',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 249,
    stripePriceId: 'price_1T9XRW2Vqta5JLGPcLtBlPjm',
    maxBuildings: Infinity,
    features: ENTERPRISE_FEATURES,
    description: 'Unlimited buildings, API access & custom branding',
  },
};

export const PAID_PLANS: PlanConfig[] = [
  PLANS.professional,
  PLANS.portfolio,
  PLANS.enterprise,
];

export function canAccess(feature: Feature, plan: string): boolean {
  const config = PLANS[plan as PlanId];
  if (config) return config.features.has(feature);
  // Legacy "pro" plan maps to professional
  if (plan === 'pro') return PROFESSIONAL_FEATURES.has(feature);
  return FREE_FEATURES.has(feature);
}

export function getPlanByPriceId(priceId: string): PlanId | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceId === priceId) return plan.id;
  }
  return null;
}

export function getMaxBuildings(plan: string): number {
  const config = PLANS[plan as PlanId];
  if (config) return config.maxBuildings;
  if (plan === 'pro') return 5;
  return 1;
}

export const MAX_FREE_BUILDINGS = 1;
