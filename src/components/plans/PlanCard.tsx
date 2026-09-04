import { Copy, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TravelPlan } from '../../domain/types';

const destinationNames = {
  beijing: '北京',
  shanghai: '上海',
  guangzhou: '广州',
  kunming: '昆明',
  nanjing: '南京',
} as const;

export function PlanCard({ plan, onRename, onCopy, onDelete }: { plan: TravelPlan; onRename: (plan: TravelPlan) => void; onCopy: (plan: TravelPlan) => void; onDelete: (plan: TravelPlan) => void }) {
  return (
    <article className="plan-card">
      <div className="plan-card__heading">
        <div><h2>{plan.name}</h2><p>{destinationNames[plan.input.destination]}</p></div>
        <span className={plan.risks.length ? 'risk-status risk-status--warning' : 'risk-status'}>{plan.risks.length ? `${plan.risks.length} 条风险` : '暂无风险'}</span>
      </div>
      <dl>
        <div><dt>日期</dt><dd>{plan.input.startDate} 至 {plan.input.endDate}</dd></div>
        <div><dt>规模</dt><dd>{plan.days.length} 天 · {plan.input.people} 人</dd></div>
        <div><dt>预计整组费用</dt><dd>¥{plan.costs.groupTotal}</dd></div>
        <div><dt>更新时间</dt><dd><time dateTime={plan.updatedAt}>{new Date(plan.updatedAt).toLocaleString('zh-CN', { hour12: false })}</time></dd></div>
      </dl>
      <div className="plan-card__actions">
        <Link className="primary-button" to={`/plans/${plan.id}`}>继续编辑</Link>
        <button type="button" className="secondary-button" aria-label="重命名计划" onClick={() => onRename(plan)}><Pencil aria-hidden="true" size={16} />重命名</button>
        <button type="button" className="secondary-button" aria-label="复制计划" onClick={() => onCopy(plan)}><Copy aria-hidden="true" size={16} />复制</button>
        <button type="button" className="secondary-button" aria-label="删除计划" onClick={() => onDelete(plan)}><Trash2 aria-hidden="true" size={16} />删除</button>
      </div>
    </article>
  );
}
