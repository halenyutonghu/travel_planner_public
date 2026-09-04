import { describe, expect, it } from 'vitest';
import city from '../../src/data/beijing';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';
import { addAttraction, removeAttraction, replaceAttraction } from '../../src/domain/itineraryEdits';
import { buildTravelPlan } from '../../src/domain/planner';

describe('行程编辑后的重新排程', () => {
  it('替换景点后重建交通且不产生时间重叠', () => {
    const plan = buildTravelPlan({ ...DEFAULT_PLANNER_INPUT, origin: '杭州', startDate: '2026-08-01', endDate: '2026-08-03' }, city, { id: 'p1', now: '2026-07-23T00:00:00.000Z' });
    const target = plan.days.flatMap((day) => day.items).find((item) => item.kind === 'attraction')!;
    const replacement = city.attractions.find((item) => item.areaId !== target.areaId && !plan.days.flatMap((day) => day.items).some((entry) => entry.sourceId === item.id))!;
    const result = replaceAttraction(plan, city, target.id, replacement);

    expect(result.error).toBeUndefined();
    const items = result.plan!.days.flatMap((day) => day.items);
    expect(items.some((item) => item.sourceId === replacement.id && item.state === 'locked')).toBe(true);
    for (const day of result.plan!.days) {
      for (let index = 1; index < day.items.length; index += 1) {
        expect(day.items[index].startTime >= day.items[index - 1].endTime).toBe(true);
      }
    }
  });

  it('允许用户主动重新加入此前删除并排除的景点', () => {
    const original = buildTravelPlan({ ...DEFAULT_PLANNER_INPUT, origin: '杭州', startDate: '2026-08-01', endDate: '2026-08-04' }, city, { id: 'p2', now: '2026-07-23T00:00:00.000Z' });
    const removedItem = original.days[1].items.find((item) => item.kind === 'attraction')!;
    const candidate = city.attractions.find((item) => item.id === removedItem.sourceId)!;
    const removed = removeAttraction(original, city, removedItem.id);
    const result = addAttraction(removed.plan!, city, removedItem.date, candidate);
    expect(result.error).toBeUndefined();
    expect(result.plan!.excludedIds).not.toContain(candidate.id);
    expect(result.plan!.days.flatMap((day) => day.items).some((item) => item.sourceId === candidate.id)).toBe(true);
  });
});
