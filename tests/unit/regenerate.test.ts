import { describe, expect, it } from 'vitest';
import city from '../../src/data/beijing';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';
import { scheduleTrip } from '../../src/domain/scheduler';
import { regeneratePlan } from '../../src/domain/regenerate';
import type { TravelPlan } from '../../src/domain/types';

function existingPlan(): TravelPlan {
  const input = { ...DEFAULT_PLANNER_INPUT, origin: '杭州', startDate: '2026-08-01', endDate: '2026-08-02' };
  const scheduled = scheduleTrip(input, city);
  const locked = { ...scheduled.days[0].items.find((item) => item.kind === 'attraction')!, state: 'locked' as const };
  scheduled.days[0].items = scheduled.days[0].items.map((item) => item.id === locked.id ? locked : item);
  return {
    schemaVersion: '1', dataVersion: '1.0.0', id: 'p1', name: '北京计划',
    createdAt: '2026-07-23T00:00:00.000Z', updatedAt: '2026-07-23T00:00:00.000Z',
    input, days: scheduled.days, excludedIds: ['bj-a15'], risks: [], alternatives: [],
    costs: { outbound: 0, local: 0, lodging: 0, tickets: 0, dining: 0, groupTotal: 0, perPerson: 0, budgetDifference: null },
  };
}

describe('regeneratePlan', () => {
  it('保留锁定项目且不重新加入排除项目', () => {
    const existing = existingPlan();
    const lockedId = existing.days[0].items.find((item) => item.state === 'locked')!.sourceId;
    const result = regeneratePlan(existing, { ...existing.input, intensity: 'relaxed' }, city);
    expect(result.status).toBe('ready');
    expect(result.plan!.days.flatMap((day) => day.items).some((item) => item.sourceId === lockedId && item.state === 'locked')).toBe(true);
    expect(result.plan!.days.flatMap((day) => day.items).some((item) => item.sourceId === 'bj-a15')).toBe(false);
  });

  it('修改目的地时要求先确认清空', () => {
    const result = regeneratePlan(existingPlan(), { ...existingPlan().input, destination: 'shanghai' }, city);
    expect(result.status).toBe('destination-confirmation-required');
  });

  it('重新生成后重算费用、风险和替代建议', () => {
    const existing = existingPlan();
    const result = regeneratePlan(existing, { ...existing.input, budgetEnabled: true, budgetAmount: 100 }, city);
    expect(result.status).toBe('ready');
    expect(result.plan!.costs.groupTotal).toBeGreaterThan(0);
    expect(result.plan!.costs.groupTotal).toBe(
      result.plan!.costs.outbound + result.plan!.costs.local + result.plan!.costs.lodging + result.plan!.costs.tickets + result.plan!.costs.dining,
    );
    expect(result.plan!.risks.some((risk) => risk.code === 'over-budget')).toBe(true);
    expect(result.plan!.alternatives.length).toBeGreaterThan(0);
  });

  it('降低强度时不会静默移动或丢弃同日锁定景点', () => {
    const compactInput = { ...DEFAULT_PLANNER_INPUT, origin: '杭州', startDate: '2026-08-01', endDate: '2026-08-04', intensity: 'compact' as const };
    const scheduled = scheduleTrip(compactInput, city);
    const sourceDay = scheduled.days.find((day) => day.items.filter((item) => item.kind === 'attraction').length >= 3)!;
    sourceDay.items = sourceDay.items.map((item) => item.kind === 'attraction' ? { ...item, state: 'locked' as const } : item);
    const existing: TravelPlan = {
      schemaVersion: '1', dataVersion: '1.0.0', id: 'locked-many', name: '锁定测试',
      createdAt: '2026-07-23T00:00:00.000Z', updatedAt: '2026-07-23T00:00:00.000Z',
      input: compactInput, days: scheduled.days, excludedIds: [], risks: [], alternatives: [],
      costs: { outbound: 0, local: 0, lodging: 0, tickets: 0, dining: 0, groupTotal: 0, perPerson: 0, budgetDifference: null },
    };
    const lockedIds = sourceDay.items.filter((item) => item.state === 'locked').map((item) => item.sourceId);
    const result = regeneratePlan(existing, { ...compactInput, intensity: 'relaxed' }, city);
    if (result.status === 'ready') {
      const sameDayIds = result.plan!.days.find((day) => day.date === sourceDay.date)!.items.map((item) => item.sourceId);
      expect(lockedIds.every((id) => sameDayIds.includes(id))).toBe(true);
    } else {
      expect(result.status).toBe('blocking-conflict');
    }
  });

  it('自动房间模式修改人数时会重新计算入住安排', () => {
    const existing = existingPlan();
    const result = regeneratePlan(existing, { ...existing.input, people: 6, customRooms: false }, city);
    expect(result.status).toBe('ready');
    expect(result.plan!.input.roomOccupancy).toEqual([2, 2, 2]);
    expect(result.plan!.costs.lodging).toBeGreaterThan(existing.costs.lodging);
  });
});
