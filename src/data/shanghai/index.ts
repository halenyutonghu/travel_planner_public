import type { CityData } from '../../domain/types';
import areas from './areas.json';
import attractions from './attractions.json';
import restaurants from './restaurants.json';
import hotels from './hotels.json';
import travelMatrix from './travel-matrix.json';

const city = {
  schemaVersion: '1', dataVersion: '1.0.0', id: 'shanghai', name: '上海',
  areas, attractions, restaurants, hotels, travelMatrix,
  arrivalPointAreaId: 'central', departurePointAreaId: 'central',
  origins: [
    { names: ['北京'], modes: [{ mode: 'train', durationMinutes: 270, pricePerPerson: 560 }] },
    { names: ['广州'], modes: [{ mode: 'flight', durationMinutes: 150, pricePerPerson: 850 }] },
    { names: ['昆明'], modes: [{ mode: 'flight', durationMinutes: 185, pricePerPerson: 920 }] },
    { names: ['南京'], modes: [{ mode: 'train', durationMinutes: 90, pricePerPerson: 160 }] },
    { names: ['杭州'], modes: [{ mode: 'train', durationMinutes: 60, pricePerPerson: 80 }] }
  ],
  fallbackOrigin: { mode: 'train', durationMinutes: 300, pricePerPerson: 520 }
} as const;

export default city as unknown as CityData;
