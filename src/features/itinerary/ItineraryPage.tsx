import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Alternative, Attraction, CityData, ItineraryItem, TravelPlan } from '../../domain/types';
import { planRepository } from '../../storage/planRepository';
import { loadCityData } from '../../data/loader';
import { regeneratePlan } from '../../domain/regenerate';
import { DayCard } from '../../components/itinerary/DayCard';
import { PlanSummary } from '../../components/itinerary/PlanSummary';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CandidateDrawer } from '../../components/itinerary/CandidateDrawer';
import { addAttraction, moveAttraction, moveAttractionToDate, removeAttraction, replaceAttraction } from '../../domain/itineraryEdits';
import './itinerary.css';

export function ItineraryPage() {
  const { planId = '' } = useParams();
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ItineraryItem | null>(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [city, setCity] = useState<CityData | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<ItineraryItem | null>(null);
  const [addDate, setAddDate] = useState('');
  const [preferredCandidateId, setPreferredCandidateId] = useState<string | undefined>();

  useEffect(() => {
    const found = planRepository.getPlan(planId);
    if (!found.ok) setError(found.error);
    else if (!found.value) setError('没有找到该计划');
    else {
      setPlan(found.value);
      void loadCityData(found.value.input.destination).then(setCity).catch(() => setError('无法读取该城市的模拟数据'));
      if (found.warnings?.length) setError('部分本地计划无法加载');
    }
  }, [planId]);

  function persist(next: TravelPlan) {
    const updated = { ...next, updatedAt: new Date().toISOString() };
    const saved = planRepository.savePlan(updated);
    if (!saved.ok) setError(saved.error);
    else {
      setPlan(updated);
      setError('');
    }
  }

  function toggleLock(item: ItineraryItem) {
    if (!plan) return;
    persist({ ...plan, days: plan.days.map((day) => ({ ...day, items: day.items.map((entry) => entry.id === item.id ? { ...entry, state: entry.state === 'locked' ? 'generated' : 'locked' } : entry) })) });
  }

  function confirmDelete() {
    if (!plan || !deleteTarget || !city) return;
    const result = removeAttraction(plan, city, deleteTarget.id);
    if (result.error) setError(result.error);
    else if (result.plan) persist(result.plan);
    setDeleteTarget(null);
  }

  function move(item: ItineraryItem, direction: 'up' | 'down') {
    if (!plan || !city) return;
    const result = moveAttraction(plan, city, item.id, direction);
    if (result.error) setError(result.error);
    else if (result.plan) {
      persist(result.plan);
      setChangeSummary(`已${direction === 'up' ? '上移' : '下移'}“${item.name}”，并将手动调整的景点锁定。`);
    }
  }

  function moveDate(item: ItineraryItem, date: string) {
    if (!plan || !city) return;
    const result = moveAttractionToDate(plan, city, item.id, date);
    if (result.error) setError(result.error);
    else if (result.plan) {
      persist(result.plan);
      setChangeSummary(`已将“${item.name}”移动到 ${date} 并锁定。`);
    }
  }

  function confirmReplace(candidate: Attraction) {
    if (!plan || !replaceTarget || !city) return;
    const result = replaceAttraction(plan, city, replaceTarget.id, candidate);
    if (result.error) setError(result.error);
    else if (result.plan) {
      persist(result.plan);
      setChangeSummary(`已将“${replaceTarget.name}”替换为“${candidate.name}”，并锁定新景点。`);
      setReplaceTarget(null);
      setPreferredCandidateId(undefined);
    }
  }

  function confirmAdd(candidate: Attraction) {
    if (!plan || !city || !addDate) return;
    const result = addAttraction(plan, city, addDate, candidate);
    if (result.error) setError(result.error);
    else if (result.plan) {
      persist(result.plan);
      setChangeSummary(`已在 ${addDate} 增加“${candidate.name}”，并锁定新景点。`);
      setAddDate('');
    }
  }

  function viewAlternative(alternative: Alternative) {
    if (!plan || !city || !alternative.replacementSourceId) return;
    const target = [...plan.days.flatMap((day) => day.items).filter((item) => item.kind === 'attraction')].sort((a, b) => b.cost - a.cost)[0];
    if (!target) return;
    setPreferredCandidateId(alternative.replacementSourceId);
    setReplaceTarget(target);
  }

  async function regenerate() {
    if (!plan) return;
    try {
      const city = await loadCityData(plan.input.destination);
      const result = regeneratePlan(plan, plan.input, city);
      if (result.status === 'blocking-conflict') setError(`锁定内容发生冲突：${result.conflicts?.join('；')}`);
      else if (result.plan && result.summary) {
        persist(result.plan);
        setChangeSummary(`已保留 ${result.summary.kept} 项，新增 ${result.summary.added} 项，移除 ${result.summary.removed} 项，仍有 ${result.summary.risks} 条风险。`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '重新生成失败');
    }
  }

  if (error && !plan) return <main><div className="persistent-error" role="alert">{error}</div><Link to="/plans">返回本地计划</Link></main>;
  if (!plan) return <main><p role="status">正在读取计划…</p></main>;

  return (
    <main>
      <div className="page-heading">
        <div><h1>{plan.name}</h1><p>{plan.input.startDate} 至 {plan.input.endDate} · {plan.input.people} 人</p></div>
        <div className="heading-actions"><span className="simulation-badge">模拟数据，仅供演示</span><Link className="secondary-button" to={`/new?edit=${plan.id}`}>修改条件</Link><button className="secondary-button" type="button" onClick={() => window.print()}>打印</button></div>
      </div>
      <p className="disclaimer">本产品使用模拟或估算数据，仅供功能演示，不作为实际预订或出行依据。出行前请通过官方渠道核实价格、营业时间、交通和安全信息。</p>
      {error && <div className="persistent-error" role="alert">{error}</div>}
      {changeSummary && <div className="change-summary" role="status">{changeSummary}</div>}
      <div className="itinerary-layout">
        <div className="itinerary-days">{plan.days.map((day, index) => <DayCard key={day.date} day={day} index={index} dates={plan.days.map((entry) => entry.date)} riskCount={plan.risks.filter((risk) => risk.date === day.date).length} onToggleLock={toggleLock} onDelete={setDeleteTarget} onReplace={(item) => { setPreferredCandidateId(undefined); setReplaceTarget(item); }} onMove={move} onMoveDate={moveDate} onAdd={setAddDate} />)}</div>
        <div className="itinerary-sidebar"><PlanSummary plan={plan} onViewAlternative={viewAlternative} /><button type="button" className="primary-button regenerate-button" onClick={regenerate}>重新生成</button></div>
      </div>
      {deleteTarget && <ConfirmDialog title="删除行程项目" message={`删除“${deleteTarget.name}”后，后续重新生成不会再次加入该项目。`} confirmLabel="确认删除项目" dangerous onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
      {replaceTarget && city && <CandidateDrawer initialCandidateId={preferredCandidateId} candidates={city.attractions.filter((candidate) => !plan.days.flatMap((day) => day.items).some((item) => item.sourceId === candidate.id))} excludedIds={plan.excludedIds} areaNames={Object.fromEntries(city.areas.map((area) => [area.id, area.name]))} onConfirm={confirmReplace} onClose={() => { setReplaceTarget(null); setPreferredCandidateId(undefined); }} />}
      {addDate && city && <CandidateDrawer mode="add" candidates={city.attractions.filter((candidate) => !plan.days.flatMap((day) => day.items).some((item) => item.sourceId === candidate.id))} excludedIds={plan.excludedIds} areaNames={Object.fromEntries(city.areas.map((area) => [area.id, area.name]))} onConfirm={confirmAdd} onClose={() => setAddDate('')} />}
    </main>
  );
}
