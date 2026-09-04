import { describe, expect, it } from 'vitest';
import type { Attraction } from '../../src/domain/types';
import { rankCandidates } from '../../src/domain/ranking';

const candidates: Attraction[] = [
  { id: 'c', name: '普通项目', areaId: 'west', categories: ['nature'], durationMinutes: 90, ticketPerPerson: 10, tiers: ['comfortable'], fixedRank: 1 },
  { id: 'b', name: '同区项目', areaId: 'central', categories: ['nature'], durationMinutes: 90, ticketPerPerson: 30, tiers: ['comfortable'], fixedRank: 2 },
  { id: 'a', name: '特别喜欢项目', areaId: 'west', categories: ['history'], durationMinutes: 90, ticketPerPerson: 50, tiers: ['comfortable'], fixedRank: 3 },
];

describe('rankCandidates', () => {
  it('特别喜欢优先于普通喜欢和路线集中度', () => {
    const result = rankCandidates(candidates, {
      interests: { history: 'special', nature: 'normal' },
      spendingTier: 'comfortable',
      currentAreaId: 'central',
    });
    expect(result.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('相同输入始终得到相同顺序', () => {
    const context = { interests: {}, spendingTier: 'comfortable' as const, currentAreaId: 'central' };
    expect(rankCandidates(candidates, context)).toEqual(rankCandidates(candidates, context));
  });
});
