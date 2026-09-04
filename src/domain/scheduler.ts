import type { AreaTransport, CityData, Hotel, ItineraryDay, ItineraryItem, PlannerInput, Restaurant } from './types';
import { tripDayCount } from './dates';
import { rankCandidates } from './ranking';

export interface ScheduleResult {
  days: ItineraryDay[];
  unscheduledIds: string[];
  blockingConflicts: string[];
}

export interface ScheduleOptions {
  fixedAttractionIdsByDate?: Record<string, string[]>;
  pinnedAttractionIdsByDate?: Record<string, string[]>;
  lockedSourceIds?: string[];
}

const intensityLimit = { relaxed: 2, moderate: 3, compact: 4 } as const;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function addDays(date: string, offset: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function transportCost(transport: AreaTransport, people: number): number {
  if (transport.pricing === 'perPerson') return Math.round(transport.price * people);
  if (transport.pricing === 'perVehicle') return Math.round(transport.price * Math.ceil(people / 4));
  return Math.round(transport.price);
}

export function chooseTransport(city: CityData, fromAreaId: string, toAreaId: string, input: PlannerInput): AreaTransport | null {
  const choices = fromAreaId === toAreaId
    ? city.areas.find((area) => area.id === fromAreaId)?.defaultTransports ?? []
    : city.travelMatrix.filter((entry) => entry.fromAreaId === fromAreaId && entry.toAreaId === toAreaId);
  const preferred = choices.filter((choice) => input.localModes.length === 0 || input.localModes.includes(choice.mode as PlannerInput['localModes'][number]));
  return [...(preferred.length ? preferred : choices)].sort((a, b) => a.durationMinutes - b.durationMinutes || a.mode.localeCompare(b.mode))[0] ?? null;
}

function hotelCandidates(input: PlannerInput, city: CityData): Hotel[] {
  const matches = (hotel: Hotel, enforcePreferredArea: boolean) =>
    (input.hotelGrade === 'any' || hotel.grade === input.hotelGrade)
    && (!enforcePreferredArea || input.preferredAreaId === null || hotel.areaId === input.preferredAreaId)
    && (input.hotelPriceMin === null || hotel.pricePerRoomNight >= input.hotelPriceMin)
    && (input.hotelPriceMax === null || hotel.pricePerRoomNight <= input.hotelPriceMax);
  const preferred = city.hotels.filter((hotel) => matches(hotel, true));
  const fallback = city.hotels.filter((hotel) => matches(hotel, false));
  return (preferred.length ? preferred : fallback).sort((a, b) => a.fixedRank - b.fixedRank);
}

function chooseNearestHotel(input: PlannerInput, city: CityData, areaIds: string[]): Hotel {
  const candidates = hotelCandidates(input, city);
  const scored = candidates.map((hotel) => {
    const score = areaIds.reduce((sum, areaId) => {
      const transport = chooseTransport(city, areaId, hotel.areaId, input);
      return sum + (transport?.durationMinutes ?? 10_000);
    }, 0);
    return { hotel, score };
  });
  return scored.sort((a, b) => a.score - b.score || a.hotel.pricePerRoomNight - b.hotel.pricePerRoomNight || a.hotel.fixedRank - b.hotel.fixedRank)[0]?.hotel
    ?? [...city.hotels].sort((a, b) => a.fixedRank - b.fixedRank)[0];
}

function chooseRestaurant(city: CityData, areaId: string, usedRestaurantIds: Set<string>): Restaurant | null {
  const inArea = city.restaurants
    .filter((item) => item.areaId === areaId && !usedRestaurantIds.has(item.id))
    .sort((a, b) => a.fixedRank - b.fixedRank);
  const fallback = city.restaurants
    .filter((item) => !usedRestaurantIds.has(item.id))
    .sort((a, b) => a.fixedRank - b.fixedRank);
  return inArea[0] ?? fallback[0] ?? null;
}

function makeItem(id: string, sourceId: string, kind: ItineraryItem['kind'], name: string, date: string, start: number, duration: number, areaId: string, cost: number, metadata?: ItineraryItem['metadata'], state: ItineraryItem['state'] = 'generated'): ItineraryItem {
  return { id, sourceId, kind, name, date, startTime: toTime(start), endTime: toTime(start + duration), areaId, state, cost, metadata };
}

function lastPosition(items: ItineraryItem[], start: number, startArea: string): { current: number; areaId: string } {
  const last = [...items].sort((a, b) => a.endTime.localeCompare(b.endTime)).at(-1);
  return last ? { current: toMinutes(last.endTime), areaId: last.areaId } : { current: start, areaId: startArea };
}

function isDislikedAttraction(input: PlannerInput, item: CityData['attractions'][number]): boolean {
  return item.categories.some((category) => input.interests[category] === 'disliked');
}

export function scheduleTrip(input: PlannerInput, city: CityData, locked: ItineraryItem[] = [], excludedIds: string[] = [], options: ScheduleOptions = {}): ScheduleResult {
  const dayCount = tripDayCount(input.startDate, input.endDate);
  if (dayCount < 1 || dayCount > 7) return { days: [], unscheduledIds: [], blockingConflicts: ['旅行日期无效'] };

  const legacyLocked = [...locked].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  for (let index = 1; index < legacyLocked.length; index += 1) {
    const previous = legacyLocked[index - 1];
    const current = legacyLocked[index];
    if (previous.date === current.date && previous.endTime > current.startTime) {
      return { days: [], unscheduledIds: [], blockingConflicts: [`${previous.name} 与 ${current.name} 时间重叠`] };
    }
  }

  const excluded = new Set(excludedIds);
  const lockedSources = new Set([...locked.map((item) => item.sourceId), ...(options.lockedSourceIds ?? [])]);
  const exactIds = new Set(Object.values(options.fixedAttractionIdsByDate ?? {}).flat());
  const allPinnedIds = new Set(Object.values(options.pinnedAttractionIdsByDate ?? {}).flat());
  let remaining = rankCandidates(city.attractions.filter((item) => !excluded.has(item.id) && !isDislikedAttraction(input, item) && (!options.fixedAttractionIdsByDate || exactIds.has(item.id))), {
    interests: input.interests,
    spendingTier: input.spendingTier,
    currentAreaId: city.arrivalPointAreaId,
  });
  const days: ItineraryDay[] = [];
  const blockingConflicts: string[] = [];
  let overnightHotel: Hotel | null = null;
  const usedRestaurantIds = new Set<string>();

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const date = addDays(input.startDate, dayIndex);
    const isFirst = dayIndex === 0;
    const isLast = dayIndex === dayCount - 1;
    const startLimit = isFirst ? toMinutes(input.arrivalTime) : 9 * 60;
    const endLimit = isLast ? toMinutes(input.departureTime) : ({ relaxed: 17, moderate: 19, compact: 21 }[input.intensity] * 60);
    const startArea: string = isFirst ? city.arrivalPointAreaId : overnightHotel?.areaId ?? city.arrivalPointAreaId;
    const items: ItineraryItem[] = [];
    let current = startLimit;
    let currentArea: string = startArea;
    let lunchAdded = false;
    let dinnerAdded = false;
    const fixedIds = options.fixedAttractionIdsByDate?.[date];
    const pinnedIds = options.pinnedAttractionIdsByDate?.[date] ?? legacyLocked.filter((item) => item.date === date && item.kind === 'attraction').map((item) => item.sourceId);
    const orderedIds = fixedIds ?? [...pinnedIds, ...remaining.map((item) => item.id).filter((id) => !allPinnedIds.has(id))];
    const daysRemaining = dayCount - dayIndex;
    const desired = fixedIds ? fixedIds.length : Math.max(pinnedIds.length, Math.min(intensityLimit[input.intensity], Math.ceil(remaining.length / daysRemaining)));
    let placed = 0;

    for (const attractionId of orderedIds) {
      if (placed >= desired) break;
      const attraction = remaining.find((item) => item.id === attractionId);
      if (!attraction) continue;
      const transport = chooseTransport(city, currentArea, attraction.areaId, input);
      if (!transport) continue;
      if (!lunchAdded && current <= 13 * 60 && current + transport.durationMinutes + attraction.durationMinutes > 13 * 60) {
        const restaurant = chooseRestaurant(city, currentArea, usedRestaurantIds);
        const mealStart = Math.max(current, 12 * 60);
        if (restaurant && mealStart + 60 <= endLimit) {
          items.push(makeItem(`${date}-lunch`, restaurant.id, 'meal', restaurant.name, date, mealStart, 60, restaurant.areaId, Math.round(restaurant.costPerPerson * input.people), { meal: 'lunch' }));
          usedRestaurantIds.add(restaurant.id);
          current = mealStart + 60;
          lunchAdded = true;
        }
      }
      if (!isLast && !dinnerAdded && current <= 19 * 60 && current + transport.durationMinutes + attraction.durationMinutes > 19 * 60) {
        const restaurant = chooseRestaurant(city, currentArea, usedRestaurantIds);
        const mealStart = Math.max(current, 18 * 60);
        if (restaurant && mealStart + 60 <= endLimit) {
          items.push(makeItem(`${date}-dinner`, restaurant.id, 'meal', restaurant.name, date, mealStart, 60, restaurant.areaId, Math.round(restaurant.costPerPerson * input.people), { meal: 'dinner' }));
          usedRestaurantIds.add(restaurant.id);
          current = mealStart + 60;
          dinnerAdded = true;
        }
      }
      if (current + transport.durationMinutes + attraction.durationMinutes > endLimit) continue;
      items.push(makeItem(`${date}-transport-${attraction.id}`, `${currentArea}-${attraction.areaId}`, 'transport', '区域间模拟交通', date, current, transport.durationMinutes, attraction.areaId, transportCost(transport, input.people), { mode: transport.mode, distanceKm: transport.distanceKm }));
      current += transport.durationMinutes;
      items.push(makeItem(`${date}-attraction-${attraction.id}`, attraction.id, 'attraction', attraction.name, date, current, attraction.durationMinutes, attraction.areaId, Math.round(attraction.ticketPerPerson * input.people), { durationMinutes: attraction.durationMinutes }, lockedSources.has(attraction.id) ? 'locked' : 'generated'));
      current += attraction.durationMinutes;
      currentArea = attraction.areaId;
      remaining = remaining.filter((item) => item.id !== attraction.id);
      placed += 1;
    }

    if (!isLast && !dinnerAdded && current <= 19 * 60) {
      const restaurant = chooseRestaurant(city, currentArea, usedRestaurantIds);
      const dinnerStart = Math.max(current, 18 * 60);
      if (restaurant && dinnerStart + 60 <= endLimit) {
        items.push(makeItem(`${date}-dinner`, restaurant.id, 'meal', restaurant.name, date, dinnerStart, 60, restaurant.areaId, Math.round(restaurant.costPerPerson * input.people), { meal: 'dinner' }));
        usedRestaurantIds.add(restaurant.id);
      }
    }

    const attractionAreaIds = items.filter((item) => item.kind === 'attraction').map((item) => item.areaId);
    const dailyHotel: Hotel | null = isLast ? null : chooseNearestHotel(input, city, attractionAreaIds.length ? attractionAreaIds : [currentArea]);
    const targetArea = isLast ? city.departurePointAreaId : dailyHotel!.areaId;
    let returnItem: ItineraryItem | null = null;
    while (!returnItem) {
      const position = lastPosition(items, startLimit, startArea);
      const transport = chooseTransport(city, position.areaId, targetArea, input);
      if (transport && position.current + transport.durationMinutes <= endLimit) {
        returnItem = makeItem(`${date}-transport-end`, `${position.areaId}-${targetArea}`, 'transport', isLast ? '前往离开点' : '返回住宿', date, position.current, transport.durationMinutes, targetArea, transportCost(transport, input.people), { mode: transport.mode, distanceKm: transport.distanceKm });
        items.push(returnItem);
        break;
      }
      const removable = [...items].reverse().find((item) => item.state === 'generated' && (item.kind === 'attraction' || item.kind === 'meal'));
      if (!removable) {
        blockingConflicts.push(`${date} 无法在离开时间前安排${isLast ? '前往离开点' : '返回住宿'}的必要交通`);
        break;
      }
      const inbound = removable.kind === 'attraction'
        ? items.find((item) => item.kind === 'transport' && item.endTime === removable.startTime && item.areaId === removable.areaId)
        : undefined;
      const removeFrom = toMinutes(inbound?.startTime ?? removable.startTime);
      if (removable.kind === 'attraction') {
        const source = city.attractions.find((item) => item.id === removable.sourceId);
        if (source && !remaining.some((item) => item.id === source.id)) remaining.push(source);
      }
      for (let index = items.length - 1; index >= 0; index -= 1) {
        if (toMinutes(items[index].startTime) >= removeFrom || items[index].id === removable.id) items.splice(index, 1);
      }
    }

    if (returnItem && !isLast) {
      const nightlyCost = Math.round(dailyHotel!.pricePerRoomNight * input.roomOccupancy.length);
      items.push(makeItem(`${date}-hotel`, dailyHotel!.id, 'hotel', dailyHotel!.name, date, toMinutes(returnItem.endTime), 0, dailyHotel!.areaId, nightlyCost, { pricePerRoomNight: dailyHotel!.pricePerRoomNight, rooms: input.roomOccupancy.length }));
      overnightHotel = dailyHotel;
    }
    items.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime) || a.id.localeCompare(b.id));
    const returnEnd = returnItem ? toMinutes(returnItem.endTime) : endLimit;
    const restHours = isLast ? null : Math.round(((24 * 60 - returnEnd + 9 * 60) / 60) * 10) / 10;
    days.push({ date, items, totalCost: items.reduce((sum, item) => sum + item.cost, 0), restHours });
  }

  if (options.fixedAttractionIdsByDate && remaining.length) {
    blockingConflicts.push(`以下手动安排无法在指定日期完成：${remaining.map((item) => item.name).join('、')}`);
  }
  const missingPinned = remaining.filter((item) => allPinnedIds.has(item.id));
  if (missingPinned.length) {
    blockingConflicts.push(`以下锁定景点无法保留在原日期：${missingPinned.map((item) => item.name).join('、')}`);
  }
  return { days, unscheduledIds: remaining.map((item) => item.id), blockingConflicts };
}
