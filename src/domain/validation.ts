import type { PlannerInput } from './types';
import { tripDayCount } from './dates';
import { roomsAreValid } from './rooms';

export interface FieldError { field: keyof PlannerInput; message: string; }

export function validatePlannerInput(input: PlannerInput): FieldError[] {
  const errors: FieldError[] = [];
  if (!input.origin.trim()) errors.push({ field: 'origin', message: '请填写出发地' });
  else if (input.origin.trim().length > 30) errors.push({ field: 'origin', message: '出发地最多 30 个字符' });
  const days = tripDayCount(input.startDate, input.endDate);
  if (!input.startDate) errors.push({ field: 'startDate', message: '请选择开始日期' });
  if (!input.endDate || days === 0) errors.push({ field: 'endDate', message: '结束日期不能早于开始日期' });
  else if (days > 7) errors.push({ field: 'endDate', message: '旅行天数必须为 1～7 天' });
  if (!Number.isInteger(input.people) || input.people < 1 || input.people > 6) errors.push({ field: 'people', message: '出行人数必须为 1～6 人' });
  if (input.customRooms && !roomsAreValid(input.roomOccupancy, input.people)) errors.push({ field: 'roomOccupancy', message: `入住人数合计必须等于 ${input.people}` });
  if (input.budgetEnabled && (input.budgetAmount === null || input.budgetAmount <= 0)) errors.push({ field: 'budgetAmount', message: '预算金额必须大于 0' });
  if (input.hotelPriceMin !== null && input.hotelPriceMax !== null && input.hotelPriceMin > input.hotelPriceMax) errors.push({ field: 'hotelPriceMax', message: '最高价不能低于最低价' });
  if (input.allergyNote.length > 200) errors.push({ field: 'allergyNote', message: '备注最多 200 个字符' });
  return errors;
}
