import { describe, expect, it } from 'vitest';
import city from '../../src/data/beijing';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';
import { scheduleTrip } from '../../src/domain/scheduler';

const input = {
  ...DEFAULT_PLANNER_INPUT,
  origin: '杭州',
  destination: 'beijing' as const,
  startDate: '2026-08-01',
  endDate: '2026-08-02',
  people: 2,
  roomOccupancy: [2],
};

describe('scheduleTrip', () => {
  it('第一天不早于抵达时间，最后一天不晚于离开时间', () => {
    const result = scheduleTrip(input, city);
    expect(result.blockingConflicts).toEqual([]);
    expect(result.days).toHaveLength(2);
    expect(result.days[0].items[0].startTime >= '12:00').toBe(true);
    expect(result.days[1].items.at(-1)!.endTime <= '16:00').toBe(true);
  });

  it('项目之间没有时间重叠且餐饮为 60 分钟', () => {
    const result = scheduleTrip(input, city);
    for (const day of result.days) {
      for (let index = 1; index < day.items.length; index += 1) {
        expect(day.items[index].startTime >= day.items[index - 1].endTime).toBe(true);
      }
      for (const meal of day.items.filter((item) => item.kind === 'meal')) {
        const [sh, sm] = meal.startTime.split(':').map(Number);
        const [eh, em] = meal.endTime.split(':').map(Number);
        expect(eh * 60 + em - (sh * 60 + sm)).toBe(60);
      }
    }
  });

  it('整个行程中同一家餐厅最多只安排一次', () => {
    const result = scheduleTrip({ ...input, endDate: '2026-08-07', intensity: 'compact' }, city);
    const restaurantIds = result.days.flatMap((day) => day.items).filter((item) => item.kind === 'meal').map((item) => item.sourceId);
    expect(new Set(restaurantIds).size).toBe(restaurantIds.length);
  });

  it('非最后一天每天都安排晚餐', () => {
    const result = scheduleTrip({ ...input, endDate: '2026-08-07', intensity: 'compact' }, city);
    const overnightDays = result.days.slice(0, -1);
    expect(overnightDays.every((day) => day.items.some((item) => item.kind === 'meal' && item.metadata?.meal === 'dinner'))).toBe(true);
  });

  it('每天都保留返回住宿或前往离开点的必要交通', () => {
    const result = scheduleTrip({ ...input, endDate: '2026-08-03' }, city);
    expect(result.blockingConflicts).toEqual([]);
    result.days.forEach((day, index) => {
      const requiredName = index === result.days.length - 1 ? '前往离开点' : '返回住宿';
      expect(day.items.some((item) => item.kind === 'transport' && item.name === requiredName)).toBe(true);
      if (index < result.days.length - 1) {
        expect(day.items.some((item) => item.kind === 'hotel')).toBe(true);
        expect(day.restHours).toBeGreaterThan(0);
      }
    });
  });

  it('根据当天景点区域安排当晚最近的酒店', () => {
    const result = scheduleTrip({ ...input, endDate: '2026-08-03' }, city, [], [], {
      fixedAttractionIdsByDate: {
        '2026-08-01': ['bj-a01'],
        '2026-08-02': ['bj-a28'],
        '2026-08-03': ['bj-a11'],
      },
    });

    expect(result.blockingConflicts).toEqual([]);
    const firstNightHotel = result.days[0].items.find((item) => item.kind === 'hotel');
    const secondNightHotel = result.days[1].items.find((item) => item.kind === 'hotel');
    expect(firstNightHotel?.areaId).toBe('bj-palace-wangfujing');
    expect(secondNightHotel?.areaId).toBe('bj-houhai-gulou');
    expect(firstNightHotel?.sourceId).not.toBe(secondNightHotel?.sourceId);
  });

  it('生成行程时排除用户不喜欢的景点类型', () => {
    const result = scheduleTrip({ ...input, interests: { history: 'disliked' } }, city);
    const scheduledAttractionIds = result.days.flatMap((day) => day.items).filter((item) => item.kind === 'attraction').map((item) => item.sourceId);
    const scheduledAttractions = city.attractions.filter((attraction) => scheduledAttractionIds.includes(attraction.id));
    expect(scheduledAttractions.every((attraction) => !attraction.categories.includes('history'))).toBe(true);
  });

  it.each([1, 2, 3, 4, 5, 6, 7])('北京可以生成 %i 天计划', (days) => {
    const end = `2026-08-${String(days).padStart(2, '0')}`;
    const result = scheduleTrip({ ...input, endDate: end }, city);
    expect(result.days).toHaveLength(days);
    expect(result.blockingConflicts).toEqual([]);
  });
});
