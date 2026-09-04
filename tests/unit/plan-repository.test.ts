import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';
import type { TravelPlan } from '../../src/domain/types';
import { createPlanRepository } from '../../src/storage/planRepository';

function plan(id = 'p1', updatedAt = '2026-07-23T01:00:00.000Z'): TravelPlan {
  return {
    schemaVersion: '1', dataVersion: '1.0.0', id, name: '北京计划',
    createdAt: '2026-07-23T00:00:00.000Z', updatedAt,
    input: { ...DEFAULT_PLANNER_INPUT, origin: '杭州', startDate: '2026-08-01', endDate: '2026-08-02' },
    days: [], excludedIds: [], risks: [], alternatives: [],
    costs: { outbound: 0, local: 0, lodging: 0, tickets: 0, dining: 0, groupTotal: 0, perPerson: 0, budgetDifference: null },
  };
}

describe('planRepository', () => {
  beforeEach(() => localStorage.clear());

  it('保存并按更新时间倒序列出计划', () => {
    const repository = createPlanRepository(localStorage, () => 'new-id', () => '2026-07-23T03:00:00.000Z');
    repository.savePlan(plan('old', '2026-07-23T01:00:00.000Z'));
    repository.savePlan(plan('new', '2026-07-23T02:00:00.000Z'));
    const result = repository.listPlans();
    expect(result.ok && result.value.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('复制产生新 ID 和副本名称', () => {
    const repository = createPlanRepository(localStorage, () => 'copy-id', () => '2026-07-23T03:00:00.000Z');
    repository.savePlan(plan());
    const result = repository.copyPlan('p1');
    expect(result.ok && result.value).toMatchObject({ id: 'copy-id', name: '北京计划 - 副本' });
  });

  it('跳过损坏记录并返回警告', () => {
    localStorage.setItem('light-trip-plans', JSON.stringify([plan(), { schemaVersion: 'broken' }]));
    const result = createPlanRepository(localStorage).listPlans();
    expect(result.ok && result.value).toHaveLength(1);
    expect(result.ok && result.warnings).toHaveLength(1);
  });

  it('写入失败时返回错误', () => {
    const brokenStorage = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); }, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 } satisfies Storage;
    const result = createPlanRepository(brokenStorage).savePlan(plan());
    expect(result).toMatchObject({
      ok: false,
      error: '浏览器存储空间不足、隐私模式限制或写入失败。请清理浏览器空间、关闭隐私模式后重试，或先打印/另存为 PDF 保留当前页面。',
    });
  });
});
