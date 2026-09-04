import type { CostSummary, PlannerInput } from './types';

export interface CostInputs {
  outboundPerPerson: number;
  localPerPerson: number;
  taxiPerVehicle: number;
  lodgingPerRoomNight: number;
  ticketPerPerson: number;
  diningPerPerson: number;
}

export function normalizeGroupBudget(input: PlannerInput): number | null {
  if (!input.budgetEnabled || input.budgetAmount === null) return null;
  return Math.round(input.budgetMode === 'perPerson' ? input.budgetAmount * input.people : input.budgetAmount);
}

export function calculateCosts(values: CostInputs, input: PlannerInput, nights: number): CostSummary {
  const round = (value: number) => Math.round(value);
  const outbound = round(values.outboundPerPerson * input.people);
  const local = round(values.localPerPerson * input.people) + round(values.taxiPerVehicle * Math.ceil(input.people / 4));
  const lodging = round(values.lodgingPerRoomNight * input.roomOccupancy.length * nights);
  const tickets = round(values.ticketPerPerson * input.people);
  const dining = round(values.diningPerPerson * input.people);
  const groupTotal = outbound + local + lodging + tickets + dining;
  const budget = normalizeGroupBudget(input);
  return { outbound, local, lodging, tickets, dining, groupTotal, perPerson: round(groupTotal / input.people), budgetDifference: budget === null ? null : budget - groupTotal };
}
