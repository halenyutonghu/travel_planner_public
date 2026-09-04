import { describe, expect, it } from 'vitest';
import type { CityData } from '../../src/domain/types';
import { validateCityData } from '../../src/data/loader';

function validCity(): CityData {
  const areas = Array.from({ length: 4 }, (_, i) => ({ id: `area-${i}`, name: `区域${i}`, defaultTransports: [{ mode: 'walk' as const, distanceKm: 1, durationMinutes: 15, pricing: 'perPerson' as const, price: 0 }] }));
  const categories = ['nature', 'history', 'landmark', 'museum', 'food', 'shopping', 'family'] as const;
  const travelMatrix = areas.flatMap((from) => areas.filter((to) => to.id !== from.id).map((to) => ({ fromAreaId: from.id, toAreaId: to.id, mode: 'publicTransit' as const, distanceKm: 8, durationMinutes: 30, pricing: 'perPerson' as const, price: 4 })));
  return {
    schemaVersion: '1', dataVersion: '1.0.0', id: 'beijing', name: '北京', areas,
    attractions: Array.from({ length: 15 }, (_, i) => ({ id: `a-${i}`, name: `活动${i}`, areaId: areas[i % 4].id, categories: [categories[i % 7]], durationMinutes: 120, ticketPerPerson: 20, tiers: ['comfortable'], fixedRank: i })),
    restaurants: Array.from({ length: 10 }, (_, i) => ({ id: `r-${i}`, name: `餐厅${i}`, areaId: areas[i % 4].id, cuisines: ['local'], costPerPerson: 50, durationMinutes: 60, fixedRank: i })),
    hotels: Array.from({ length: 6 }, (_, i) => ({ id: `h-${i}`, name: `酒店${i}`, areaId: areas[i % 4].id, grade: ['economy', 'three-star', 'four-star', 'five-star'][i % 4] as CityData['hotels'][number]['grade'], pricePerRoomNight: 300 + i * 100, fixedRank: i })),
    travelMatrix, arrivalPointAreaId: 'area-0', departurePointAreaId: 'area-0',
    origins: Array.from({ length: 5 }, (_, i) => ({ names: [`出发地${i}`], modes: [{ mode: 'train' as const, durationMinutes: 300, pricePerPerson: 500 }] })),
    fallbackOrigin: { mode: 'train', durationMinutes: 360, pricePerPerson: 600 },
  };
}

describe('validateCityData', () => {
  it('接受满足第一版最低规模的数据', () => {
    expect(validateCityData(validCity())).toEqual([]);
  });

  it('指出重复 ID', () => {
    const city = validCity();
    city.attractions[1].id = city.attractions[0].id;
    expect(validateCityData(city)).toContainEqual(expect.objectContaining({ field: 'id', recordId: 'a-0' }));
  });

  it('指出无效区域引用和缺失反向交通', () => {
    const city = validCity();
    city.attractions[0].areaId = 'missing';
    city.travelMatrix = city.travelMatrix.filter((entry) => !(entry.fromAreaId === 'area-1' && entry.toAreaId === 'area-0'));
    const issues = validateCityData(city);
    expect(issues).toContainEqual(expect.objectContaining({ recordId: 'a-0', field: 'areaId' }));
    expect(issues).toContainEqual(expect.objectContaining({ recordId: 'area-1→area-0', field: 'travelMatrix' }));
  });
});
