import type { PlannerInput } from '../../domain/types';
import { tripDayCount } from '../../domain/dates';

const cityNames = { beijing: '北京', shanghai: '上海', guangzhou: '广州', kunming: '昆明', nanjing: '南京' };

export function ConditionSummary({ value }: { value: PlannerInput }) {
  const days = tripDayCount(value.startDate, value.endDate);
  return (
    <aside className="condition-summary" aria-label="当前条件摘要">
      <h2>当前条件摘要</h2>
      <dl>
        <div><dt>目的地</dt><dd>{cityNames[value.destination]}</dd></div>
        <div><dt>日期</dt><dd>{value.startDate && value.endDate ? `${value.startDate} 至 ${value.endDate}` : '尚未填写'}</dd></div>
        <div><dt>天数</dt><dd>{days || '—'}</dd></div>
        <div><dt>人数</dt><dd>{value.people} 人</dd></div>
        <div><dt>预算</dt><dd>{value.budgetEnabled ? `${value.budgetAmount ?? '—'} 元（${value.budgetMode === 'group' ? '整组' : '人均'}）` : '未设置'}</dd></div>
      </dl>
    </aside>
  );
}
