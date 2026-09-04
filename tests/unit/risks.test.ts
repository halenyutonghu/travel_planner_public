import { describe, expect, it } from 'vitest';
import city from '../../src/data/beijing';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';
import type { TravelPlan } from '../../src/domain/types';
import { detectRisks } from '../../src/domain/risks';
import { findAlternatives } from '../../src/domain/alternatives';

function plan(): TravelPlan {
  const input = { ...DEFAULT_PLANNER_INPUT, origin: '未知城市', startDate: '2026-08-01', endDate: '2026-08-02', budgetEnabled: true, budgetAmount: 1000 };
  return {
    schemaVersion: '1', dataVersion: '1.0.0', id: 'p1', name: '测试计划',
    createdAt: '2026-07-23T00:00:00.000Z', updatedAt: '2026-07-23T00:00:00.000Z', input,
    days: [{
      date: '2026-08-01', totalCost: 1200, restHours: 6,
      items: [
        { id: 'i1', sourceId: 'bj-a01', kind: 'attraction', name: '项目1', date: '2026-08-01', startTime: '09:00', endTime: '10:00', areaId: 'central', state: 'generated', cost: 400 },
        { id: 'i2', sourceId: 'bj-a05', kind: 'attraction', name: '项目2', date: '2026-08-01', startTime: '11:00', endTime: '12:00', areaId: 'north', state: 'generated', cost: 400 },
        { id: 'i3', sourceId: 'bj-a02', kind: 'attraction', name: '项目3', date: '2026-08-01', startTime: '14:00', endTime: '15:00', areaId: 'central', state: 'generated', cost: 400 },
      ],
    }],
    excludedIds: [], alternatives: [],
    costs: { outbound: 400, local: 100, lodging: 300, tickets: 200, dining: 200, groupTotal: 1200, perPerson: 1200, budgetDifference: -200 },
    risks: [],
  };
}

describe('detectRisks', () => {
  it('识别超预算、休息不足、路线折返和通用估算', () => {
    const risks = detectRisks(plan(), city);
    expect(risks.map((risk) => risk.code)).toEqual(expect.arrayContaining(['over-budget', 'insufficient-rest', 'route-backtrack', 'fallback-origin']));
  });
});

describe('findAlternatives', () => {
  it('为超预算风险返回更低成本的候选但不修改计划', () => {
    const original = plan();
    const before = structuredClone(original);
    const alternatives = findAlternatives(original, city, { id: 'r1', level: 'warning', code: 'over-budget', title: '超预算', message: '超预算 200 元', value: 200 });
    expect(alternatives.length).toBeGreaterThan(0);
    expect(original).toEqual(before);
  });
});
