import { describe, expect, it } from 'vitest';
import { tripDayCount, lodgingNightCount } from '../../src/domain/dates';
import { defaultRoomOccupancy, roomsAreValid } from '../../src/domain/rooms';
import { normalizeGroupBudget, calculateCosts } from '../../src/domain/money';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';

describe('日期与房间计算', () => {
  it('开始和结束同日为 1 天 0 晚', () => {
    expect(tripDayCount('2026-08-01', '2026-08-01')).toBe(1);
    expect(lodgingNightCount(1)).toBe(0);
  });
  it('相差六个自然日为 7 天', () => expect(tripDayCount('2026-08-01', '2026-08-07')).toBe(7));
  it('四人默认分为两间双人房', () => expect(defaultRoomOccupancy(4)).toEqual([2, 2]));
  it('拒绝人数合计不一致的房间', () => expect(roomsAreValid([2, 1], 4)).toBe(false));
});

describe('预算与费用计算', () => {
  it('将三人的人均预算换算为整组预算', () => {
    expect(normalizeGroupBudget({ ...DEFAULT_PLANNER_INPUT, people: 3, budgetEnabled: true, budgetMode: 'perPerson', budgetAmount: 2000 })).toBe(6000);
  });
  it('按照计价单位计算并汇总费用', () => {
    const result = calculateCosts({ outboundPerPerson: 500, localPerPerson: 20, taxiPerVehicle: 40, lodgingPerRoomNight: 300, ticketPerPerson: 60, diningPerPerson: 100 }, { ...DEFAULT_PLANNER_INPUT, people: 5, roomOccupancy: [2, 2, 1] }, 2);
    expect(result).toMatchObject({ outbound: 2500, local: 180, lodging: 1800, tickets: 300, dining: 500, groupTotal: 5280, perPerson: 1056 });
  });
});
