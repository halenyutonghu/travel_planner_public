import { describe, expect, it } from 'vitest';
import { CityDataSchema } from '../../src/data/schema';
import { TravelPlanSchema } from '../../src/storage/schema';

const validCity = {
  schemaVersion: '1', dataVersion: '1.0.0', id: 'beijing', name: '北京',
  areas: [{ id: 'center', name: '中心城区', defaultTransports: [{ mode: 'walk', distanceKm: 1, durationMinutes: 15, pricing: 'perPerson', price: 0 }] }],
  attractions: [{ id: 'a1', name: '示例景点', areaId: 'center', categories: ['history'], durationMinutes: 120, ticketPerPerson: 20, tiers: ['comfortable'], fixedRank: 1 }],
  restaurants: [{ id: 'r1', name: '示例餐厅', areaId: 'center', cuisines: ['local'], costPerPerson: 50, durationMinutes: 60, fixedRank: 1 }],
  hotels: [{ id: 'h1', name: '示例酒店', areaId: 'center', grade: 'three-star', pricePerRoomNight: 400, fixedRank: 1 }],
  travelMatrix: [],
  arrivalPointAreaId: 'center', departurePointAreaId: 'center',
  origins: [{ names: ['杭州'], modes: [{ mode: 'train', durationMinutes: 300, pricePerPerson: 500 }] }],
  fallbackOrigin: { mode: 'train', durationMinutes: 360, pricePerPerson: 600 },
};

describe('CityDataSchema', () => {
  it('接受结构正确的城市数据', () => {
    expect(() => CityDataSchema.parse(validCity)).not.toThrow();
  });

  it('拒绝负数价格', () => {
    const invalid = structuredClone(validCity);
    invalid.attractions[0].ticketPerPerson = -1;
    expect(() => CityDataSchema.parse(invalid)).toThrow();
  });
});

describe('TravelPlanSchema', () => {
  it('拒绝不支持的结构版本', () => {
    expect(() => TravelPlanSchema.parse({ schemaVersion: 'unsupported' })).toThrow();
  });
});
