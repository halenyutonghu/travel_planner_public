import type { Alternative, TravelPlan } from '../../domain/types';
import { normalizeGroupBudget } from '../../domain/money';

export function PlanSummary({ plan, onViewAlternative }: { plan: TravelPlan; onViewAlternative?: (alternative: Alternative) => void }) {
  const budget = normalizeGroupBudget(plan.input);
  return (
    <aside className="plan-summary" aria-label="计划费用和风险摘要">
      <h2>费用摘要</h2>
      <p className="total-label">预计整组费用<strong>¥{plan.costs.groupTotal}</strong></p>
      <p>预计人均费用 ¥{plan.costs.perPerson}</p>
      <p>{budget === null ? '未设置用户预算' : `用户${plan.input.budgetMode === 'group' ? '整组' : '人均'}预算：¥${plan.input.budgetAmount}`}</p>
      {plan.costs.budgetDifference !== null && <p className={plan.costs.budgetDifference < 0 ? 'budget-over' : 'budget-within'}>{plan.costs.budgetDifference < 0 ? `预计超出预算 ¥${Math.abs(plan.costs.budgetDifference)}` : `预计结余 ¥${plan.costs.budgetDifference}`}</p>}
      <dl>
        <div><dt>往返交通</dt><dd>¥{plan.costs.outbound}</dd></div>
        <div><dt>市内交通</dt><dd>¥{plan.costs.local}</dd></div>
        <div><dt>住宿</dt><dd>¥{plan.costs.lodging}</dd></div>
        <div><dt>门票</dt><dd>¥{plan.costs.tickets}</dd></div>
        <div><dt>餐饮</dt><dd>¥{plan.costs.dining}</dd></div>
      </dl>
      <h2>风险与提醒</h2>
      {plan.risks.length === 0 ? <p>当前没有发现明显风险。</p> : <ul className="risk-list">{plan.risks.map((risk) => <li key={risk.id} className={`risk risk--${risk.level}`}><strong>{risk.title}</strong><span>{risk.message}</span></li>)}</ul>}
      {plan.alternatives.length > 0 && <><h2>可选替代建议</h2><ul className="alternative-list">{plan.alternatives.map((alternative) => <li key={alternative.id}><strong>{alternative.title}</strong><span>{alternative.description}</span>{onViewAlternative && <button type="button" className="secondary-button" onClick={() => onViewAlternative(alternative)}>查看并采用该建议</button>}</li>)}</ul></>}
    </aside>
  );
}
