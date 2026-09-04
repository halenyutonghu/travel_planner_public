import { z } from 'zod';

const plannerInput = z.object({
  origin: z.string(), destination: z.enum(['beijing', 'shanghai', 'guangzhou', 'kunming', 'nanjing']),
  startDate: z.string(), endDate: z.string(), people: z.number().int(), arrivalTime: z.string(), departureTime: z.string(),
  budgetEnabled: z.boolean(), budgetMode: z.enum(['group', 'perPerson']), budgetAmount: z.number().nullable(),
  spendingTier: z.enum(['economy', 'comfortable', 'quality']), customRooms: z.boolean(), roomOccupancy: z.array(z.number().int()),
  hotelGrade: z.enum(['economy', 'three-star', 'four-star', 'five-star', 'any']), preferredAreaId: z.string().nullable(),
  hotelPriceMin: z.number().nullable(), hotelPriceMax: z.number().nullable(), outboundModes: z.array(z.enum(['flight', 'train', 'selfDrive'])),
  localModes: z.array(z.enum(['publicTransit', 'walk', 'taxi'])), interests: z.record(z.string(), z.enum(['disliked', 'normal', 'special'])),
  cuisines: z.array(z.string()), allergyNote: z.string(), intensity: z.enum(['relaxed', 'moderate', 'compact']), minimumRestHours: z.number(),
});

const item = z.object({ id: z.string(), sourceId: z.string(), kind: z.enum(['attraction', 'meal', 'transport', 'hotel']), name: z.string(), date: z.string(), startTime: z.string(), endTime: z.string(), areaId: z.string(), state: z.enum(['generated', 'locked', 'excluded']), cost: z.number(), metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional() });
const risk = z.object({ id: z.string(), level: z.enum(['blocking', 'warning', 'info']), code: z.string(), title: z.string(), message: z.string(), date: z.string().optional(), itemIds: z.array(z.string()).optional(), value: z.number().optional() });
const alternative = z.object({ id: z.string(), riskId: z.string(), title: z.string(), description: z.string(), replacementSourceId: z.string().optional(), savingAmount: z.number().optional(), savingMinutes: z.number().optional(), preferenceLoss: z.string().optional() });
const costs = z.object({ outbound: z.number(), local: z.number(), lodging: z.number(), tickets: z.number(), dining: z.number(), groupTotal: z.number(), perPerson: z.number(), budgetDifference: z.number().nullable() });

export const TravelPlanSchema = z.object({
  schemaVersion: z.literal('1'), dataVersion: z.string(), id: z.string(), name: z.string(), createdAt: z.string(), updatedAt: z.string(),
  input: plannerInput, days: z.array(z.object({ date: z.string(), items: z.array(item), totalCost: z.number(), restHours: z.number().nullable() })),
  excludedIds: z.array(z.string()), risks: z.array(risk), alternatives: z.array(alternative), costs,
});
