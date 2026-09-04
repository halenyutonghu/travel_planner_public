import { describe, expect, it } from 'vitest';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';
import { buildTravelPlan } from '../../src/domain/planner';
import type { DestinationId } from '../../src/domain/types';
import { loadCityData } from '../../src/data/loader';
import { validateCityData } from '../../src/data/validator';

const destinations: DestinationId[] = ['beijing', 'shanghai', 'guangzhou', 'kunming', 'nanjing'];
const chineseTextPattern = /[\u4e00-\u9fff]/;

describe('五城市离线数据', () => {
  for (const destination of destinations) {
    it(`${destination} 数据完整并可确定性生成 1～7 日行程`, async () => {
      const city = await loadCityData(destination);
      expect(validateCityData(city)).toEqual([]);
      for (let dayCount = 1; dayCount <= 7; dayCount += 1) {
        const input = {
          ...DEFAULT_PLANNER_INPUT,
          origin: '杭州',
          destination,
          startDate: '2026-08-01',
          endDate: `2026-08-${String(dayCount).padStart(2, '0')}`,
        };
        const options = { id: `${destination}-${dayCount}`, now: '2026-07-23T00:00:00.000Z' };
        const plan = buildTravelPlan(input, city, options);
        const repeated = buildTravelPlan(input, city, options);
        expect(plan).toEqual(repeated);
        expect(plan.days).toHaveLength(dayCount);
        expect(plan.days.flatMap((day) => day.items).every((item) => chineseTextPattern.test(item.name))).toBe(true);
        const attractions = plan.days.flatMap((day) => day.items).filter((item) => item.kind === 'attraction');
        expect(new Set(attractions.map((item) => item.sourceId)).size).toBe(attractions.length);
        expect(plan.costs.groupTotal).toBe(plan.costs.outbound + plan.costs.local + plan.costs.lodging + plan.costs.tickets + plan.costs.dining);
        expect(plan.days.flatMap((day) => day.items).some((item) => item.name.includes('模拟'))).toBe(true);
        for (const day of plan.days) {
          for (let index = 1; index < day.items.length; index += 1) {
            expect(day.items[index].startTime >= day.items[index - 1].endTime).toBe(true);
          }
        }
      }
    });
  }
});
