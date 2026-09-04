import type { CityData, DestinationId } from '../domain/types';
import { CityDataSchema } from './schema';

export { validateCityData } from './validator';
export type { ValidationIssue } from './validator';

const cityLoaders = import.meta.glob<{ default: CityData }>('./*/index.ts');

export async function loadCityData(destination: DestinationId): Promise<CityData> {
  const loader = cityLoaders[`./${destination}/index.ts`];
  if (!loader) throw new Error(`当前城市模拟数据不足：${destination}`);
  const module = await loader();
  return CityDataSchema.parse(module.default) as CityData;
}
