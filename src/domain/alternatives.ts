import type { Alternative, CityData, Risk, TravelPlan } from './types';

export function findAlternatives(plan: TravelPlan, city: CityData, risk: Risk): Alternative[] {
  if (risk.code !== 'over-budget' && risk.code !== 'route-backtrack' && risk.code !== 'insufficient-rest') return [];
  const used = new Set(plan.days.flatMap((day) => day.items.map((item) => item.sourceId)));
  const excluded = new Set(plan.excludedIds);
  const currentAttractions = city.attractions.filter((item) => used.has(item.id));
  const mostExpensive = [...currentAttractions].sort((a, b) => b.ticketPerPerson - a.ticketPerPerson || a.fixedRank - b.fixedRank)[0];
  if (!mostExpensive) return [];

  return city.attractions
    .filter((item) => !used.has(item.id) && !excluded.has(item.id) && item.ticketPerPerson < mostExpensive.ticketPerPerson)
    .sort((a, b) => a.ticketPerPerson - b.ticketPerPerson || a.fixedRank - b.fixedRank)
    .slice(0, 3)
    .map((item, index) => ({
      id: `alternative-${risk.id}-${index}`,
      riskId: risk.id,
      title: `将“${mostExpensive.name}”替换为“${item.name}”`,
      description: `预计整组节省 ${(mostExpensive.ticketPerPerson - item.ticketPerPerson) * plan.input.people} 元；替换后仍需重新检查时间和交通。`,
      replacementSourceId: item.id,
      savingAmount: (mostExpensive.ticketPerPerson - item.ticketPerPerson) * plan.input.people,
      preferenceLoss: '可能降低原景点的兴趣匹配程度',
    }));
}
