import type { Attraction, InterestCategory, InterestPreference, SpendingTier } from './types';

export interface RankingContext {
  interests: Partial<Record<InterestCategory, InterestPreference>>;
  spendingTier: SpendingTier;
  currentAreaId?: string;
}

function interestScore(item: Attraction, context: RankingContext): number {
  return Math.max(0, ...item.categories.map((category) => context.interests[category] === 'special' ? 2 : context.interests[category] === 'normal' ? 1 : 0));
}

export function rankCandidates(candidates: Attraction[], context: RankingContext): Attraction[] {
  return [...candidates].sort((a, b) => {
    const comparisons = [
      interestScore(b, context) - interestScore(a, context),
      Number(b.tiers.includes(context.spendingTier)) - Number(a.tiers.includes(context.spendingTier)),
      Number(b.areaId === context.currentAreaId) - Number(a.areaId === context.currentAreaId),
      a.ticketPerPerson - b.ticketPerPerson,
      a.fixedRank - b.fixedRank,
    ];
    return comparisons.find((value) => value !== 0) ?? a.id.localeCompare(b.id);
  });
}
