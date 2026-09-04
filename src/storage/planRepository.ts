import type { TravelPlan } from '../domain/types';
import { TravelPlanSchema } from './schema';

const STORAGE_KEY = 'light-trip-plans';
const WRITE_FAILURE_MESSAGE = '浏览器存储空间不足、隐私模式限制或写入失败。请清理浏览器空间、关闭隐私模式后重试，或先打印/另存为 PDF 保留当前页面。';

export type RepositoryResult<T> =
  | { ok: true; value: T; warnings?: string[] }
  | { ok: false; error: string };

export interface PlanRepository {
  listPlans(): RepositoryResult<TravelPlan[]>;
  getPlan(id: string): RepositoryResult<TravelPlan | null>;
  savePlan(plan: TravelPlan): RepositoryResult<TravelPlan>;
  renamePlan(id: string, name: string): RepositoryResult<TravelPlan>;
  copyPlan(id: string): RepositoryResult<TravelPlan>;
  deletePlan(id: string): RepositoryResult<void>;
}

export function createPlanRepository(
  storage: Storage = window.localStorage,
  createId: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): PlanRepository {
  function read(): { plans: TravelPlan[]; warnings: string[] } {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { plans: [], warnings: [] };
    try {
      const values: unknown = JSON.parse(raw);
      if (!Array.isArray(values)) return { plans: [], warnings: ['本地计划数据格式损坏'] };
      const plans: TravelPlan[] = [];
      const warnings: string[] = [];
      for (const value of values) {
        const parsed = TravelPlanSchema.safeParse(value);
        if (parsed.success) plans.push(parsed.data as TravelPlan);
        else warnings.push('一条本地计划无法加载');
      }
      return { plans, warnings };
    } catch {
      return { plans: [], warnings: ['本地计划数据无法读取'] };
    }
  }

  function write(plans: TravelPlan[]): RepositoryResult<void> {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(plans));
      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: WRITE_FAILURE_MESSAGE };
    }
  }

  function listPlans(): RepositoryResult<TravelPlan[]> {
    const { plans, warnings } = read();
    plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { ok: true, value: plans, ...(warnings.length ? { warnings } : {}) };
  }

  function getPlan(id: string): RepositoryResult<TravelPlan | null> {
    const result = listPlans();
    if (!result.ok) return result;
    return { ok: true, value: result.value.find((plan) => plan.id === id) ?? null, warnings: result.warnings };
  }

  function savePlan(plan: TravelPlan): RepositoryResult<TravelPlan> {
    const { plans } = read();
    const index = plans.findIndex((item) => item.id === plan.id);
    if (index >= 0) plans[index] = plan;
    else plans.push(plan);
    const written = write(plans);
    return written.ok ? { ok: true, value: plan } : written;
  }

  function renamePlan(id: string, name: string): RepositoryResult<TravelPlan> {
    const found = getPlan(id);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: '没有找到该计划' };
    const renamed = { ...found.value, name, updatedAt: now() };
    return savePlan(renamed);
  }

  function copyPlan(id: string): RepositoryResult<TravelPlan> {
    const found = getPlan(id);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: '没有找到该计划' };
    const timestamp = now();
    const copied = { ...structuredClone(found.value), id: createId(), name: `${found.value.name} - 副本`, createdAt: timestamp, updatedAt: timestamp };
    return savePlan(copied);
  }

  function deletePlan(id: string): RepositoryResult<void> {
    return write(read().plans.filter((plan) => plan.id !== id));
  }

  return { listPlans, getPlan, savePlan, renamePlan, copyPlan, deletePlan };
}

export const planRepository = createPlanRepository();
