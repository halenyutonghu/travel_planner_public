import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PlannerInput, TravelPlan } from '../../domain/types';
import { loadCityData } from '../../data/loader';
import { buildTravelPlan } from '../../domain/planner';
import { planRepository } from '../../storage/planRepository';
import { PlannerForm } from './PlannerForm';
import { regeneratePlan } from '../../domain/regenerate';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

export function PlannerPage() {
  return <PlannerSection />;
}

export function PlannerSection({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [existing] = useState<TravelPlan | null>(() => {
    if (!editId) return null;
    const result = planRepository.getPlan(editId);
    return result.ok ? result.value : null;
  });
  const [status, setStatus] = useState<'idle' | 'generating'>('idle');
  const [error, setError] = useState('');
  const [destinationChange, setDestinationChange] = useState<PlannerInput | null>(null);

  async function generate(input: PlannerInput) {
    if (existing && input.destination !== existing.input.destination) {
      setDestinationChange(input);
      return;
    }
    await generateAndSave(input);
  }

  async function generateAndSave(input: PlannerInput, clearOldPlan = false) {
    setStatus('generating');
    setError('');
    try {
      const city = await loadCityData(input.destination);
      const id = existing?.id ?? crypto.randomUUID();
      let plan: TravelPlan;
      if (existing && !clearOldPlan) {
        const regenerated = regeneratePlan(existing, input, city);
        if (regenerated.status === 'blocking-conflict' || !regenerated.plan) {
          setError(`锁定内容与新条件冲突：${regenerated.conflicts?.join('；') ?? '请调整条件后重试'}`);
          return;
        }
        plan = regenerated.plan;
      } else {
        plan = buildTravelPlan(input, city, { id, now: new Date().toISOString() });
      }
      const saved = planRepository.savePlan(plan);
      if (!saved.ok) {
        setError(`${saved.error}。当前页面数据仍然保留，请删除旧计划后重试。`);
        return;
      }
      navigate(`/plans/${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成失败，请检查输入后重试');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <main className={embedded ? 'planner-section' : undefined}>
      <div className="page-heading">
        <div><h1>{existing ? '修改旅行条件' : '新建旅行计划'}</h1><p>填写基本条件后，系统会使用项目内的模拟数据安排每日行程；生成后的计划只保存在当前浏览器。</p></div>
        <span className="simulation-badge">模拟数据，仅供演示</span>
      </div>
      <p className="disclaimer">本产品使用模拟或估算数据，仅供功能演示，不作为实际预订或出行依据。出行前请通过官方渠道核实价格、营业时间、交通和安全信息。</p>
      {status === 'generating' && <p role="status">正在生成行程…</p>}
      {error && <div className="persistent-error" role="alert">{error}</div>}
      {editId && !existing ? <div className="persistent-error" role="alert">没有找到要修改的本地计划，请返回本地计划列表。</div> : <PlannerForm initialValue={existing?.input} onGenerate={generate} />}
      {destinationChange && <ConfirmDialog title="更换目的地" message="更换目的地会清空当前行程、锁定内容和排除列表，并使用新城市的模拟数据重新生成。" confirmLabel="清空并更换目的地" dangerous onCancel={() => setDestinationChange(null)} onConfirm={() => { const input = destinationChange; setDestinationChange(null); void generateAndSave(input, true); }} />}
    </main>
  );
}
