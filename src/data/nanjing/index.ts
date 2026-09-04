import type { CityData } from '../../domain/types';
import areas from './areas.json';
import attractions from './attractions.json';
import restaurants from './restaurants.json';
import hotels from './hotels.json';
import travelMatrix from './travel-matrix.json';

const city = {
  schemaVersion: '1', dataVersion: '1.0.0', id: 'nanjing', name: '南京',
  areas, attractions, restaurants, hotels, travelMatrix,
  arrivalPointAreaId: 'central', departurePointAreaId: 'central',
  origins: [
    { names: ['北京'], modes: [{ mode: 'train', durationMinutes: 210, pricePerPerson: 460 }] },
    { names: ['上海'], modes: [{ mode: 'train', durationMinutes: 90, pricePerPerson: 160 }] },
    { names: ['广州'], modes: [{ mode: 'flight', durationMinutes: 140, pricePerPerson: 780 }] },
    { names: ['昆明'], modes: [{ mode: 'flight', durationMinutes: 170, pricePerPerson: 880 }] },
    { names: ['杭州'], modes: [{ mode: 'train', durationMinutes: 80, pricePerPerson: 130 }] }
  ],
  fallbackOrigin: { mode: 'train', durationMinutes: 240, pricePerPerson: 420 }
} as const;

export default city as unknown as CityData;
