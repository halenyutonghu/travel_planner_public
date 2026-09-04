import type { CityData } from '../../domain/types';
import areas from './areas.json';
import attractions from './attractions.json';
import restaurants from './restaurants.json';
import hotels from './hotels.json';
import travelMatrix from './travel-matrix.json';

const city = {
  schemaVersion: '1', dataVersion: '1.0.0', id: 'kunming', name: '昆明',
  areas, attractions, restaurants, hotels, travelMatrix,
  arrivalPointAreaId: 'central', departurePointAreaId: 'central',
  origins: [
    { names: ['北京'], modes: [{ mode: 'flight', durationMinutes: 210, pricePerPerson: 1050 }] },
    { names: ['上海'], modes: [{ mode: 'flight', durationMinutes: 185, pricePerPerson: 920 }] },
    { names: ['广州'], modes: [{ mode: 'flight', durationMinutes: 130, pricePerPerson: 720 }] },
    { names: ['南京'], modes: [{ mode: 'flight', durationMinutes: 170, pricePerPerson: 880 }] },
    { names: ['杭州'], modes: [{ mode: 'flight', durationMinutes: 165, pricePerPerson: 860 }] }
  ],
  fallbackOrigin: { mode: 'flight', durationMinutes: 180, pricePerPerson: 900 }
} as const;

export default city as unknown as CityData;
