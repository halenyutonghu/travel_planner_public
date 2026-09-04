import { describe, expect, it } from 'vitest';
import { validatePlannerInput } from '../../src/domain/validation';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';

describe('validatePlannerInput', () => {
  it('指出空出发地、超过七天和房间人数不一致', () => {
    const errors = validatePlannerInput({ ...DEFAULT_PLANNER_INPUT, startDate: '2026-08-01', endDate: '2026-08-09', customRooms: true, people: 4, roomOccupancy: [2, 1] });
    expect(errors.map((error) => error.field)).toEqual(expect.arrayContaining(['origin', 'endDate', 'roomOccupancy']));
  });
  it('接受完整有效输入', () => {
    expect(validatePlannerInput({ ...DEFAULT_PLANNER_INPUT, origin: '杭州', startDate: '2026-08-01', endDate: '2026-08-03' })).toEqual([]);
  });
});
