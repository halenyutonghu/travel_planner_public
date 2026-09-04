import { z } from 'zod';

const nonNegative = z.number().finite().nonnegative();
const transportMode = z.enum(['flight', 'train', 'selfDrive', 'publicTransit', 'walk', 'taxi']);
const pricing = z.enum(['perPerson', 'perVehicle', 'group']);
const transport = z.object({ mode: transportMode, distanceKm: nonNegative, durationMinutes: nonNegative, pricing, price: nonNegative });

export const CityDataSchema = z.object({
  schemaVersion: z.literal('1'), dataVersion: z.string().min(1),
  id: z.enum(['beijing', 'shanghai', 'guangzhou', 'kunming', 'nanjing']), name: z.string().min(1),
  areas: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), defaultTransports: z.array(transport) })),
  attractions: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1), areaId: z.string().min(1),
    categories: z.array(z.enum(['nature', 'history', 'landmark', 'museum', 'food', 'shopping', 'family'])).min(1),
    durationMinutes: nonNegative, ticketPerPerson: nonNegative,
    tiers: z.array(z.enum(['economy', 'comfortable', 'quality'])).min(1), fixedRank: z.number().finite(),
  })),
  restaurants: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), areaId: z.string().min(1), cuisines: z.array(z.string()).min(1), costPerPerson: nonNegative, durationMinutes: nonNegative, fixedRank: z.number().finite() })),
  hotels: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), areaId: z.string().min(1), grade: z.enum(['economy', 'three-star', 'four-star', 'five-star']), pricePerRoomNight: nonNegative, fixedRank: z.number().finite() })),
  travelMatrix: z.array(z.object({ fromAreaId: z.string().min(1), toAreaId: z.string().min(1) }).extend(transport.shape)),
  arrivalPointAreaId: z.string().min(1), departurePointAreaId: z.string().min(1),
  origins: z.array(z.object({ names: z.array(z.string().min(1)).min(1), modes: z.array(z.object({ mode: z.enum(['flight', 'train', 'selfDrive']), durationMinutes: nonNegative, pricePerPerson: nonNegative })).min(1) })),
  fallbackOrigin: z.object({ mode: z.enum(['flight', 'train', 'selfDrive']), durationMinutes: nonNegative, pricePerPerson: nonNegative }),
});

export type ParsedCityData = z.infer<typeof CityDataSchema>;
