import type { CityData, Risk, TravelPlan } from './types';

export function detectRisks(plan: TravelPlan, city: CityData): Risk[] {
  const risks: Risk[] = [];
  if (plan.costs.budgetDifference !== null && plan.costs.budgetDifference < 0) {
    const amount = Math.abs(plan.costs.budgetDifference);
    risks.push({ id: 'risk-over-budget', level: 'warning', code: 'over-budget', title: '预计费用超出预算', message: `预计超出预算 ${amount} 元`, value: amount });
  }

  for (const day of plan.days) {
    if (day.restHours !== null && day.restHours < plan.input.minimumRestHours) {
      const missing = plan.input.minimumRestHours - day.restHours;
      risks.push({ id: `risk-rest-${day.date}`, level: 'warning', code: 'insufficient-rest', title: '休息时间不足', message: `${day.date} 预计少休息 ${missing} 小时`, date: day.date, value: missing });
    }
    const areas = day.items.filter((item) => item.kind !== 'transport').map((item) => item.areaId);
    for (let index = 2; index < areas.length; index += 1) {
      if (areas[index] === areas[index - 2] && areas[index] !== areas[index - 1]) {
        risks.push({ id: `risk-route-${day.date}-${index}`, level: 'warning', code: 'route-backtrack', title: '存在路线折返', message: `${day.date} 离开区域后再次返回，可能增加交通时间`, date: day.date });
        break;
      }
    }
  }

  const originKnown = city.origins.some((origin) => origin.names.includes(plan.input.origin.trim()));
  if (!originKnown) {
    risks.push({ id: 'risk-fallback-origin', level: 'info', code: 'fallback-origin', title: '使用通用交通估算', message: '未找到该出发地的预置数据，已使用通用交通估算' });
  }
  if (plan.input.allergyNote.trim()) {
    risks.push({ id: 'risk-allergy-note', level: 'info', code: 'allergy-note', title: '请主动确认过敏和忌口', message: '系统仅展示备注，不能可靠排除过敏原，请在用餐前向餐厅确认。' });
  }
  return risks;
}
