export type DestinationId = 'beijing' | 'shanghai' | 'guangzhou' | 'kunming' | 'nanjing';
export type ItemState = 'generated' | 'locked' | 'excluded';
export type Intensity = 'relaxed' | 'moderate' | 'compact';
export type BudgetMode = 'group' | 'perPerson';
export type SpendingTier = 'economy' | 'comfortable' | 'quality';
export type RiskLevel = 'blocking' | 'warning' | 'info';
export type TransportMode = 'flight' | 'train' | 'selfDrive' | 'publicTransit' | 'walk' | 'taxi';
export type PricingUnit = 'perPerson' | 'perVehicle' | 'group';
export type InterestCategory = 'nature' | 'history' | 'landmark' | 'museum' | 'food' | 'shopping' | 'family';
export type InterestPreference = 'disliked' | 'normal' | 'special';

export interface PlannerInput {
  origin: string;
  destination: DestinationId;
  startDate: string;
  endDate: string;
  people: number;
  arrivalTime: string;
  departureTime: string;
  budgetEnabled: boolean;
  budgetMode: BudgetMode;
  budgetAmount: number | null;
  spendingTier: SpendingTier;
  customRooms: boolean;
  roomOccupancy: number[];
  hotelGrade: 'economy' | 'three-star' | 'four-star' | 'five-star' | 'any';
  preferredAreaId: string | null;
  hotelPriceMin: number | null;
  hotelPriceMax: number | null;
  outboundModes: Array<'flight' | 'train' | 'selfDrive'>;
  localModes: Array<'publicTransit' | 'walk' | 'taxi'>;
  interests: Partial<Record<InterestCategory, InterestPreference>>;
  cuisines: string[];
  allergyNote: string;
  intensity: Intensity;
  minimumRestHours: number;
}

export interface AreaTransport {
  mode: TransportMode;
  distanceKm: number;
  durationMinutes: number;
  pricing: PricingUnit;
  price: number;
}

export interface Area { id: string; name: string; defaultTransports: AreaTransport[]; }
export interface Attraction { id: string; name: string; areaId: string; categories: InterestCategory[]; durationMinutes: number; ticketPerPerson: number; tiers: SpendingTier[]; fixedRank: number; }
export interface Restaurant { id: string; name: string; areaId: string; cuisines: string[]; costPerPerson: number; durationMinutes: number; fixedRank: number; }
export interface Hotel { id: string; name: string; areaId: string; grade: PlannerInput['hotelGrade']; pricePerRoomNight: number; fixedRank: number; }
export interface TravelMatrixEntry extends AreaTransport { fromAreaId: string; toAreaId: string; }
export interface OriginData { names: string[]; modes: Array<{ mode: 'flight' | 'train' | 'selfDrive'; durationMinutes: number; pricePerPerson: number }>; }

export interface CityData {
  schemaVersion: '1'; dataVersion: string; id: DestinationId; name: string;
  areas: Area[]; attractions: Attraction[]; restaurants: Restaurant[]; hotels: Hotel[];
  travelMatrix: TravelMatrixEntry[]; arrivalPointAreaId: string; departurePointAreaId: string;
  origins: OriginData[]; fallbackOrigin: OriginData['modes'][number];
}

export interface ItineraryItem {
  id: string; sourceId: string; kind: 'attraction' | 'meal' | 'transport' | 'hotel';
  name: string; date: string; startTime: string; endTime: string; areaId: string;
  state: ItemState; cost: number; metadata?: Record<string, string | number | boolean>;
}

export interface ItineraryDay { date: string; items: ItineraryItem[]; totalCost: number; restHours: number | null; }
export interface CostSummary { outbound: number; local: number; lodging: number; tickets: number; dining: number; groupTotal: number; perPerson: number; budgetDifference: number | null; }
export interface Risk { id: string; level: RiskLevel; code: string; title: string; message: string; date?: string; itemIds?: string[]; value?: number; }
export interface Alternative { id: string; riskId: string; title: string; description: string; replacementSourceId?: string; savingAmount?: number; savingMinutes?: number; preferenceLoss?: string; }

export interface TravelPlan {
  schemaVersion: '1'; dataVersion: string; id: string; name: string; createdAt: string; updatedAt: string;
  input: PlannerInput; days: ItineraryDay[]; excludedIds: string[]; risks: Risk[]; alternatives: Alternative[]; costs: CostSummary;
}
