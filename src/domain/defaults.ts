import type { PlannerInput } from './types';

export const DEFAULT_PLANNER_INPUT: PlannerInput = {
  origin: '', destination: 'beijing', startDate: '', endDate: '', people: 1,
  arrivalTime: '12:00', departureTime: '16:00', budgetEnabled: false,
  budgetMode: 'group', budgetAmount: null, spendingTier: 'comfortable',
  customRooms: false, roomOccupancy: [1], hotelGrade: 'any', preferredAreaId: null,
  hotelPriceMin: null, hotelPriceMax: null, outboundModes: [], localModes: [],
  interests: {}, cuisines: [], allergyNote: '', intensity: 'moderate', minimumRestHours: 8,
};
