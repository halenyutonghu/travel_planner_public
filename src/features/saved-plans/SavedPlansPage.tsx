import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TravelPlan } from '../../domain/types';
import { planRepository } from '../../storage/planRepository';
import { PlanCard } from '../../components/plans/PlanCard';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import './saved-plans.css';
import { trapTabKey } from '../../components/common/focusTrap';

export function SavedPlansPage() {
  return <SavedPlansSection />;
}

export function SavedPlansSection({ embedded = false, onCreatePlan }: { embedded?: boolean; onCreatePlan?: () => void }) {
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [renameTarget, setRenameTarget] = useState<TravelPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TravelPlan | null>(null);
  const [name, setName] = useState('');
  const renameDialogRef = useRef<HTMLElement>(null);

  function loadPlans() {
    const result = planRepository.listPlans();
    if (!result.ok) setError(result.error);
    else {
      setPlans(result.value);
      setWarning(result.warnings?.length ? '部分本地计划无法加载，未损坏的计划仍可正常使用。' : '');
    }
  }

  useEffect(loadPlans, []);

  function startRename(plan: TravelPlan) {
    setRenameTarget(plan);
    setName(plan.name);
  }

  function saveName() {
    if (!renameTarget || !name.trim()) return;
    const result = planRepository.renamePlan(renameTarget.id, name.trim());
    if (!result.ok) setError(result.error);
    else {
      setRenameTarget(null);
      setError('');
      loadPlans();
    }
  }

  function copy(plan: TravelPlan) {
    const result = planRepository.copyPlan(plan.id);
    if (!result.ok) setError(result.error);
    else {
      setError('');
      loadPlans();
    }
  }

  function remove() {
    if (!deleteTarget) return;
    const result = planRepository.deletePlan(deleteTarget.id);
    if (!result.ok) setError(result.error);
    else {
      setDeleteTarget(null);
      setError('');
      loadPlans();
    }
  }

  return (
    <main className={embedded ? 'saved-plans-section' : undefined}>
      <div className="page-heading"><div><h1>本地计划</h1><p>这些计划只保存在当前浏览器中。</p></div>{onCreatePlan ? <button className="primary-button" type="button" onClick={onCreatePlan}>新建计划</button> : <Link className="primary-button" to="/new">新建计划</Link>}</div>
      {warning && <div className="persistent-error" role="alert">{warning}</div>}
      {error && <div className="persistent-error" role="alert">{error}</div>}
      {plans.length === 0 ? (
        <section className="plans-empty">
          <FileText aria-hidden="true" size={40} />
          <h2>还没有本地计划</h2>
          <p>先填写一次出行条件，生成后就会自动保存在这里。</p>
          {onCreatePlan ? <button className="primary-button" type="button" onClick={onCreatePlan}>新建计划</button> : <Link className="primary-button" to="/new">新建计划</Link>}
        </section>
      ) : (
        <div className="plans-grid">{plans.map((plan) => <PlanCard key={plan.id} plan={plan} onRename={startRename} onCopy={copy} onDelete={setDeleteTarget} />)}</div>
      )}
      {renameTarget && (
        <div className="dialog-backdrop">
          <section ref={renameDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title" onKeyDown={(event) => trapTabKey(event, renameDialogRef.current)}>
            <h2 id="rename-title">重命名计划</h2>
            <label className="rename-field">计划名称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
            <div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setRenameTarget(null)}>取消重命名</button><button type="button" className="primary-button" disabled={!name.trim()} onClick={saveName}>保存新名称</button></div>
          </section>
        </div>
      )}
      {deleteTarget && <ConfirmDialog title="删除计划" message={`删除“${deleteTarget.name}”后无法恢复。`} confirmLabel="确认删除计划" dangerous onCancel={() => setDeleteTarget(null)} onConfirm={remove} />}
    </main>
  );
}
