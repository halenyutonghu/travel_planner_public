import type { Attraction, CityData, TravelPlan } from './types';
import { scheduleTrip } from './scheduler';
import { calculatePlanCosts } from './planner';
import { detectRisks } from './risks';
import { findAlternatives } from './alternatives';

export interface ItineraryEditResult {
  plan?: TravelPlan;
  error?: string;
}

function attractionSchedule(plan: TravelPlan): Record<string, string[]> {
  return Object.fromEntries(plan.days.map((day) => [
    day.date,
    day.items.filter((item) => item.kind === 'attraction').map((item) => item.sourceId),
  ]));
}

function rebuild(plan: TravelPlan, city: CityData, fixedAttractionIdsByDate: Record<string, string[]>, lockedSourceIds: string[], excludedIds = plan.excludedIds): ItineraryEditResult {
  const scheduled = scheduleTrip(plan.input, city, [], excludedIds, { fixedAttractionIdsByDate, lockedSourceIds });
  if (scheduled.blockingConflicts.length) return { error: `${scheduled.blockingConflicts.join('；')}，已撤销本次修改。` };
  const next: TravelPlan = {
    ...plan,
    days: scheduled.days,
    excludedIds,
    costs: calculatePlanCosts(plan.input, city, scheduled.days),
    risks: [],
    alternatives: [],
  };
  next.risks = detectRisks(next, city);
  next.alternatives = next.risks.flatMap((risk) => findAlternatives(next, city, risk));
  return { plan: next };
}

function lockedIds(plan: TravelPlan, extra: string[] = []): string[] {
  return [...new Set([
    ...plan.days.flatMap((day) => day.items).filter((item) => item.kind === 'attraction' && item.state === 'locked').map((item) => item.sourceId),
    ...extra,
  ])];
}

export function moveAttraction(plan: TravelPlan, city: CityData, itemId: string, direction: 'up' | 'down'): ItineraryEditResult {
  const item = plan.days.flatMap((day) => day.items).find((entry) => entry.id === itemId);
  if (!item || item.kind !== 'attraction') return { plan };
  const schedule = attractionSchedule(plan);
  const entries = schedule[item.date] ?? [];
  const currentIndex = entries.indexOf(item.sourceId);
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= entries.length) return { plan };
  [entries[currentIndex], entries[targetIndex]] = [entries[targetIndex], entries[currentIndex]];
  return rebuild(plan, city, schedule, lockedIds(plan, [item.sourceId]));
}

export function moveAttractionToDate(plan: TravelPlan, city: CityData, itemId: string, targetDate: string): ItineraryEditResult {
  const item = plan.days.flatMap((day) => day.items).find((entry) => entry.id === itemId);
  if (!item || item.kind !== 'attraction' || item.date === targetDate || !plan.days.some((day) => day.date === targetDate)) return { plan };
  const schedule = attractionSchedule(plan);
  schedule[item.date] = schedule[item.date].filter((id) => id !== item.sourceId);
  schedule[targetDate] = [...(schedule[targetDate] ?? []), item.sourceId];
  return rebuild(plan, city, schedule, lockedIds(plan, [item.sourceId]));
}

export function replaceAttraction(plan: TravelPlan, city: CityData, itemId: string, candidate: Attraction): ItineraryEditResult {
  const item = plan.days.flatMap((day) => day.items).find((entry) => entry.id === itemId);
  if (!item || item.kind !== 'attraction') return { plan };
  const schedule = attractionSchedule(plan);
  schedule[item.date] = schedule[item.date].map((id) => id === item.sourceId ? candidate.id : id);
  return rebuild(plan, city, schedule, lockedIds(plan, [candidate.id]));
}

export function addAttraction(plan: TravelPlan, city: CityData, targetDate: string, candidate: Attraction): ItineraryEditResult {
  if (!plan.days.some((day) => day.date === targetDate)) return { plan };
  const schedule = attractionSchedule(plan);
  if (Object.values(schedule).flat().includes(candidate.id)) return { error: '该景点已经在计划中。' };
  schedule[targetDate] = [...(schedule[targetDate] ?? []), candidate.id];
  return rebuild(plan, city, schedule, lockedIds(plan, [candidate.id]), plan.excludedIds.filter((id) => id !== candidate.id));
}

export function removeAttraction(plan: TravelPlan, city: CityData, itemId: string): ItineraryEditResult {
  const item = plan.days.flatMap((day) => day.items).find((entry) => entry.id === itemId);
  if (!item || item.kind !== 'attraction') return { plan };
  const schedule = attractionSchedule(plan);
  schedule[item.date] = schedule[item.date].filter((id) => id !== item.sourceId);
  const excludedIds = [...new Set([...plan.excludedIds, item.sourceId])];
  return rebuild(plan, city, schedule, lockedIds(plan), excludedIds);
}
