import type { CityData } from '../../domain/types';
import areas from './areas.json';
import attractions from './attractions.json';
import restaurants from './restaurants.json';
import hotels from './hotels.json';
import travelMatrix from './travel-matrix.json';

const city = {
  schemaVersion: '1', dataVersion: '1.0.0', id: 'guangzhou', name: '广州',
  areas, attractions, restaurants, hotels, travelMatrix,
  arrivalPointAreaId: 'central', departurePointAreaId: 'central',
  origins: [
    { names: ['北京'], modes: [{ mode: 'flight', durationMinutes: 195, pricePerPerson: 950 }] },
    { names: ['上海'], modes: [{ mode: 'flight', durationMinutes: 150, pricePerPerson: 850 }] },
    { names: ['昆明'], modes: [{ mode: 'flight', durationMinutes: 130, pricePerPerson: 720 }] },
    { names: ['南京'], modes: [{ mode: 'flight', durationMinutes: 140, pricePerPerson: 780 }] },
    { names: ['杭州'], modes: [{ mode: 'flight', durationMinutes: 130, pricePerPerson: 760 }] }
  ],
  fallbackOrigin: { mode: 'train', durationMinutes: 420, pricePerPerson: 680 }
} as const;

export default city as unknown as CityData;
