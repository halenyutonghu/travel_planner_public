import type { CityData } from '../../domain/types';
import areas from './areas.json';
import attractions from './attractions.json';
import restaurants from './restaurants.json';
import hotels from './hotels.json';
import travelMatrix from './travel-matrix.json';

const city = {
  schemaVersion: '1', dataVersion: '1.0.0', id: 'beijing', name: '北京',
  areas, attractions, restaurants, hotels, travelMatrix,
  arrivalPointAreaId: 'bj-palace-wangfujing', departurePointAreaId: 'bj-palace-wangfujing',
  origins: [
    { names: ['上海'], modes: [{ mode: 'train', durationMinutes: 300, pricePerPerson: 560 }] },
    { names: ['广州'], modes: [{ mode: 'flight', durationMinutes: 195, pricePerPerson: 980 }] },
    { names: ['昆明'], modes: [{ mode: 'flight', durationMinutes: 210, pricePerPerson: 1050 }] },
    { names: ['南京'], modes: [{ mode: 'train', durationMinutes: 220, pricePerPerson: 450 }] },
    { names: ['杭州'], modes: [{ mode: 'train', durationMinutes: 270, pricePerPerson: 520 }] }
  ],
  fallbackOrigin: { mode: 'train', durationMinutes: 360, pricePerPerson: 600 }
} as const;

export default city as unknown as CityData;
