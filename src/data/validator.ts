import type { CityData, InterestCategory } from '../domain/types';
import { CityDataSchema } from './schema';

export interface ValidationIssue {
  file: string;
  recordId: string;
  field: string;
  message: string;
}

function issue(recordId: string, field: string, message: string): ValidationIssue {
  return { file: 'city-data', recordId, field, message };
}

export function validateCityData(city: CityData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parsed = CityDataSchema.safeParse(city);
  if (!parsed.success) {
    for (const error of parsed.error.issues) {
      issues.push(issue(String(error.path[1] ?? city.id), String(error.path.at(-1) ?? 'root'), error.message));
    }
  }

  for (const collection of [city.areas, city.attractions, city.restaurants, city.hotels]) {
    const seen = new Set<string>();
    for (const record of collection) {
      if (seen.has(record.id)) issues.push(issue(record.id, 'id', 'ID 必须唯一'));
      seen.add(record.id);
    }
  }

  const areaIds = new Set(city.areas.map((area) => area.id));
  for (const record of [...city.attractions, ...city.restaurants, ...city.hotels]) {
    if (!areaIds.has(record.areaId)) issues.push(issue(record.id, 'areaId', `区域 ${record.areaId} 不存在`));
  }
  if (!areaIds.has(city.arrivalPointAreaId)) issues.push(issue(city.id, 'arrivalPointAreaId', '抵达点区域不存在'));
  if (!areaIds.has(city.departurePointAreaId)) issues.push(issue(city.id, 'departurePointAreaId', '离开点区域不存在'));

  if (city.areas.length < 4 || city.areas.length > 6) issues.push(issue(city.id, 'areas', '区域数量必须为 4～6'));
  if (city.attractions.length < 15) issues.push(issue(city.id, 'attractions', '活动数量至少为 15'));
  if (city.restaurants.length < 10) issues.push(issue(city.id, 'restaurants', '餐厅数量至少为 10'));
  if (city.hotels.length < 6) issues.push(issue(city.id, 'hotels', '住宿数量至少为 6'));
  if (city.origins.length < 5) issues.push(issue(city.id, 'origins', '预置出发城市至少为 5'));

  const categories: InterestCategory[] = ['nature', 'history', 'landmark', 'museum', 'food', 'shopping', 'family'];
  for (const category of categories) {
    if (city.attractions.filter((item) => item.categories.includes(category)).length < 2) issues.push(issue(city.id, 'attractions', `${category} 类型候选少于 2 个`));
  }

  for (const grade of ['economy', 'three-star', 'four-star', 'five-star'] as const) {
    if (!city.hotels.some((hotel) => hotel.grade === grade)) issues.push(issue(city.id, 'hotels', `缺少 ${grade} 住宿`));
  }

  for (const from of city.areas) {
    if (from.defaultTransports.length === 0) issues.push(issue(from.id, 'defaultTransports', '缺少区内默认交通'));
    for (const to of city.areas) {
      if (from.id !== to.id && !city.travelMatrix.some((entry) => entry.fromAreaId === from.id && entry.toAreaId === to.id)) {
        issues.push(issue(`${from.id}→${to.id}`, 'travelMatrix', '缺少区域间交通记录'));
      }
    }
  }
  return issues;
}
