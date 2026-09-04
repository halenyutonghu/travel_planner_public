import type { CityData, PlannerInput, TravelPlan } from './types';
import { scheduleTrip } from './scheduler';
import { detectRisks } from './risks';
import { findAlternatives } from './alternatives';
import { calculatePlanCosts } from './planner';
import { defaultRoomOccupancy } from './rooms';

export interface RegenerationResult {
  status: 'ready' | 'destination-confirmation-required' | 'blocking-conflict';
  plan?: TravelPlan;
  conflicts?: string[];
  summary?: { kept: number; added: number; removed: number; risks: number };
}

export function regeneratePlan(existing: TravelPlan, nextInput: PlannerInput, city: CityData): RegenerationResult {
  if (nextInput.destination !== existing.input.destination) {
    return { status: 'destination-confirmation-required' };
  }
  const input = { ...nextInput, roomOccupancy: nextInput.customRooms ? nextInput.roomOccupancy : defaultRoomOccupancy(nextInput.people) };
  const locked = existing.days.flatMap((day) => day.items).filter((item) => item.state === 'locked');
  const pinnedAttractionIdsByDate = Object.fromEntries(existing.days.map((day) => [
    day.date,
    day.items.filter((item) => item.kind === 'attraction' && item.state === 'locked').map((item) => item.sourceId),
  ]));
  const scheduled = scheduleTrip(input, city, [], existing.excludedIds, {
    pinnedAttractionIdsByDate,
    lockedSourceIds: locked.filter((item) => item.kind === 'attraction').map((item) => item.sourceId),
  });
  if (scheduled.blockingConflicts.length) {
    return { status: 'blocking-conflict', conflicts: scheduled.blockingConflicts };
  }

  const previousGenerated = new Set(existing.days.flatMap((day) => day.items).filter((item) => item.state === 'generated').map((item) => item.sourceId));
  const nextGenerated = new Set(scheduled.days.flatMap((day) => day.items).filter((item) => item.state === 'generated').map((item) => item.sourceId));
  const plan: TravelPlan = {
    ...existing,
    input,
    days: scheduled.days,
    updatedAt: new Date().toISOString(),
    costs: calculatePlanCosts(input, city, scheduled.days),
    risks: [],
    alternatives: [],
  };
  plan.risks = detectRisks(plan, city);
  plan.alternatives = plan.risks.flatMap((risk) => findAlternatives(plan, city, risk));
  return {
    status: 'ready',
    plan,
    summary: {
      kept: locked.length,
      added: [...nextGenerated].filter((id) => !previousGenerated.has(id)).length,
      removed: [...previousGenerated].filter((id) => !nextGenerated.has(id)).length,
      risks: plan.risks.length,
    },
  };
}
