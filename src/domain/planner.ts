import type { CityData, CostSummary, ItineraryDay, PlannerInput, TravelPlan } from './types';
import { defaultRoomOccupancy } from './rooms';
import { tripDayCount } from './dates';
import { normalizeGroupBudget } from './money';
import { scheduleTrip } from './scheduler';
import { detectRisks } from './risks';
import { findAlternatives } from './alternatives';

export interface BuildPlanOptions { id: string; now: string; }

export function calculatePlanCosts(input: PlannerInput, city: CityData, days: ItineraryDay[]): CostSummary {
  const knownOrigin = city.origins.find((origin) => origin.names.includes(input.origin.trim()));
  const originChoices = knownOrigin?.modes ?? [city.fallbackOrigin];
  const preferredOrigins = originChoices.filter((mode) => input.outboundModes.length === 0 || input.outboundModes.includes(mode.mode));
  const origin = [...(preferredOrigins.length ? preferredOrigins : originChoices)].sort((a, b) => a.pricePerPerson - b.pricePerPerson || a.durationMinutes - b.durationMinutes)[0];
  const items = days.flatMap((day) => day.items);
  const outbound = Math.round(origin.pricePerPerson * input.people);
  const local = items.filter((item) => item.kind === 'transport').reduce((sum, item) => sum + item.cost, 0);
  const lodging = items.filter((item) => item.kind === 'hotel').reduce((sum, item) => sum + item.cost, 0);
  const tickets = items.filter((item) => item.kind === 'attraction').reduce((sum, item) => sum + item.cost, 0);
  const dining = items.filter((item) => item.kind === 'meal').reduce((sum, item) => sum + item.cost, 0);
  const groupTotal = outbound + local + lodging + tickets + dining;
  const budget = normalizeGroupBudget(input);
  return { outbound, local, lodging, tickets, dining, groupTotal, perPerson: Math.round(groupTotal / input.people), budgetDifference: budget === null ? null : budget - groupTotal };
}

export function buildTravelPlan(rawInput: PlannerInput, city: CityData, options: BuildPlanOptions): TravelPlan {
  const input = { ...rawInput, roomOccupancy: rawInput.customRooms ? rawInput.roomOccupancy : defaultRoomOccupancy(rawInput.people) };
  const scheduled = scheduleTrip(input, city);
  if (scheduled.blockingConflicts.length) throw new Error(scheduled.blockingConflicts.join('；'));
  const costs = calculatePlanCosts(input, city, scheduled.days);
  const plan: TravelPlan = {
    schemaVersion: '1', dataVersion: city.dataVersion, id: options.id,
    name: `${city.name} ${input.startDate}`, createdAt: options.now, updatedAt: options.now,
    input, days: scheduled.days, excludedIds: [], risks: [], alternatives: [],
    costs,
  };
  plan.risks = detectRisks(plan, city);
  plan.alternatives = plan.risks.flatMap((risk) => findAlternatives(plan, city, risk));
  return plan;
}
