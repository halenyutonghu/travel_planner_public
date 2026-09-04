import { describe, expect, it } from 'vitest';
import city from '../../src/data/beijing';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';
import { buildTravelPlan } from '../../src/domain/planner';

describe('buildTravelPlan', () => {
  it('生成完整费用并在未设置预算时不判断超预算', () => {
    const plan = buildTravelPlan({ ...DEFAULT_PLANNER_INPUT, origin: '杭州', startDate: '2026-08-01', endDate: '2026-08-03', people: 3 }, city, { id: 'p1', now: '2026-07-23T00:00:00.000Z' });
    expect(plan.id).toBe('p1');
    expect(plan.days).toHaveLength(3);
    expect(plan.costs.groupTotal).toBe(plan.costs.outbound + plan.costs.local + plan.costs.lodging + plan.costs.tickets + plan.costs.dining);
    expect(plan.costs.budgetDifference).toBeNull();
    expect(plan.risks.some((risk) => risk.code === 'over-budget')).toBe(false);
  });
});
