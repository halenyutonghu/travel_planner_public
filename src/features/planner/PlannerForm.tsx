import { cloneElement, useRef, useState, type ReactElement } from 'react';
import { DEFAULT_PLANNER_INPUT } from '../../domain/defaults';
import type { InterestCategory, InterestPreference, PlannerInput } from '../../domain/types';
import { validatePlannerInput } from '../../domain/validation';
import { FormSection } from '../../components/form/FormSection';
import { ConditionSummary } from './ConditionSummary';
import './planner.css';

export interface PlannerFormProps {
  initialValue?: PlannerInput;
  onGenerate: (input: PlannerInput) => void;
}

const interests: Array<[InterestCategory, string]> = [['nature', '自然风光'], ['history', '历史人文'], ['landmark', '城市地标'], ['museum', '博物馆/艺术'], ['food', '美食体验'], ['shopping', '休闲购物'], ['family', '亲子娱乐']];
const interestOptions: Array<[InterestPreference, string]> = [['disliked', '不喜欢'], ['normal', '普通'], ['special', '特别喜欢']];

export function PlannerForm({ initialValue = DEFAULT_PLANNER_INPUT, onGenerate }: PlannerFormProps) {
  const [value, setValue] = useState<PlannerInput>(initialValue);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const update = <K extends keyof PlannerInput>(key: K, next: PlannerInput[K]) => setValue((current) => ({ ...current, [key]: next }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validatePlannerInput(value);
    setErrors(Object.fromEntries(found.map((error) => [error.field, error.message])));
    if (found.length) {
      formRef.current?.querySelector<HTMLElement>(`[name="${found[0].field}"]`)?.focus();
      return;
    }
    onGenerate({ ...value, origin: value.origin.trim() });
  }

  const field = (name: keyof PlannerInput, label: string, control: ReactElement) => {
    const errorId = `${String(name)}-error`;
    return (
      <div className="field">
        <label htmlFor={String(name)}>{label}</label>
        {cloneElement(control, { id: String(name), 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? errorId : undefined } as object)}
        {errors[name] && <small id={errorId} className="field-error">{errors[name]}</small>}
      </div>
    );
  };

  function updateInterest(category: InterestCategory, preference: InterestPreference) {
    update('interests', { ...value.interests, [category]: preference });
  }

  return (
    <form ref={formRef} className="planner-layout" onSubmit={submit} noValidate>
      <div className="planner-form">
        {Object.keys(errors).length > 0 && <div className="error-summary" role="alert">请检查表单中标出的内容。</div>}
        <FormSection title="基本信息">
          <div className="field-grid">
            {field('origin', '出发地', <input name="origin" value={value.origin} maxLength={30} onChange={(e) => update('origin', e.target.value)} />)}
            {field('destination', '目的地', <select name="destination" value={value.destination} onChange={(e) => update('destination', e.target.value as PlannerInput['destination'])}><option value="beijing">北京</option><option value="shanghai">上海</option><option value="guangzhou">广州</option><option value="kunming">昆明</option><option value="nanjing">南京</option></select>)}
            {field('startDate', '开始日期', <input name="startDate" type="date" value={value.startDate} onChange={(e) => update('startDate', e.target.value)} />)}
            {field('endDate', '结束日期', <input name="endDate" type="date" value={value.endDate} onChange={(e) => update('endDate', e.target.value)} />)}
            {field('people', '出行人数', <input name="people" type="number" min="1" max="6" value={value.people} onChange={(e) => update('people', Number(e.target.value))} />)}
            {field('arrivalTime', '预计抵达时间', <input name="arrivalTime" type="time" value={value.arrivalTime} onChange={(e) => update('arrivalTime', e.target.value)} />)}
            {field('departureTime', '预计离开时间', <input name="departureTime" type="time" value={value.departureTime} onChange={(e) => update('departureTime', e.target.value)} />)}
          </div>
        </FormSection>

        <FormSection title="预算与消费档次">
          <label className="check"><input type="checkbox" checked={value.budgetEnabled} onChange={(e) => update('budgetEnabled', e.target.checked)} />设置预算</label>
          {value.budgetEnabled && <div className="field-grid">
            {field('budgetMode', '预算口径', <select name="budgetMode" value={value.budgetMode} onChange={(e) => update('budgetMode', e.target.value as PlannerInput['budgetMode'])}><option value="group">整组</option><option value="perPerson">人均</option></select>)}
            {field('budgetAmount', '预算金额（元）', <input name="budgetAmount" type="number" min="1" value={value.budgetAmount ?? ''} onChange={(e) => update('budgetAmount', e.target.value ? Number(e.target.value) : null)} />)}
          </div>}
          {field('spendingTier', '消费档次', <select name="spendingTier" value={value.spendingTier} onChange={(e) => update('spendingTier', e.target.value as PlannerInput['spendingTier'])}><option value="economy">经济</option><option value="comfortable">舒适</option><option value="quality">品质</option></select>)}
        </FormSection>

        <FormSection title="景点兴趣">
          <div className="interest-grid">{interests.map(([key, label]) => <fieldset className="interest-choice" key={key}><legend>{label}</legend><div className="interest-choice__buttons">{interestOptions.map(([preference, optionLabel]) => <button key={preference} type="button" className={`interest-choice__button${value.interests[key] === preference ? ' is-selected' : ''}`} aria-pressed={value.interests[key] === preference} aria-label={`${label} ${optionLabel}`} onClick={() => updateInterest(key, preference)}>{optionLabel}</button>)}</div></fieldset>)}</div>
        </FormSection>

        <FormSection title="行程强度与休息">
          <div className="field-grid">
            {field('intensity', '行程强度', <select name="intensity" value={value.intensity} onChange={(e) => update('intensity', e.target.value as PlannerInput['intensity'])}><option value="relaxed">轻松</option><option value="moderate">适中</option><option value="compact">紧凑</option></select>)}
            {field('minimumRestHours', '最低休息时长', <input name="minimumRestHours" type="number" min="6" max="12" value={value.minimumRestHours} onChange={(e) => update('minimumRestHours', Number(e.target.value))} />)}
          </div>
        </FormSection>

        <FormSection title="房间与住宿" collapsible open={Boolean(errors.roomOccupancy || errors.hotelPriceMax)}>
          <label className="check"><input type="checkbox" checked={value.customRooms} onChange={(e) => update('customRooms', e.target.checked)} />自定义房间入住人数</label>
          {value.customRooms && field('roomOccupancy', '每间房人数（用逗号分隔）', <input name="roomOccupancy" value={value.roomOccupancy.join(',')} onChange={(e) => update('roomOccupancy', e.target.value.split(',').map(Number).filter(Number.isFinite))} />)}
          {field('hotelGrade', '酒店档次', <select name="hotelGrade" value={value.hotelGrade} onChange={(e) => update('hotelGrade', e.target.value as PlannerInput['hotelGrade'])}><option value="any">不限</option><option value="economy">经济型/无星级</option><option value="three-star">三星</option><option value="four-star">四星</option><option value="five-star">五星</option></select>)}
          <div className="field-grid">
            {field('hotelPriceMin', '每间每晚最低价', <input name="hotelPriceMin" type="number" min="0" value={value.hotelPriceMin ?? ''} onChange={(e) => update('hotelPriceMin', e.target.value ? Number(e.target.value) : null)} />)}
            {field('hotelPriceMax', '每间每晚最高价', <input name="hotelPriceMax" type="number" min="0" value={value.hotelPriceMax ?? ''} onChange={(e) => update('hotelPriceMax', e.target.value ? Number(e.target.value) : null)} />)}
          </div>
        </FormSection>

        <FormSection title="往返及市内交通" collapsible>
          <fieldset><legend>往返交通</legend>{(['flight', 'train', 'selfDrive'] as const).map((mode) => <label className="check" key={mode}><input type="checkbox" checked={value.outboundModes.includes(mode)} onChange={(e) => update('outboundModes', e.target.checked ? [...value.outboundModes, mode] : value.outboundModes.filter((item) => item !== mode))} />{{ flight: '飞机', train: '高铁/火车', selfDrive: '自驾' }[mode]}</label>)}</fieldset>
          <fieldset><legend>市内交通</legend>{(['publicTransit', 'walk', 'taxi'] as const).map((mode) => <label className="check" key={mode}><input type="checkbox" checked={value.localModes.includes(mode)} onChange={(e) => update('localModes', e.target.checked ? [...value.localModes, mode] : value.localModes.filter((item) => item !== mode))} />{{ publicTransit: '公共交通', walk: '步行优先', taxi: '出租车/网约车' }[mode]}</label>)}</fieldset>
        </FormSection>

        <FormSection title="饮食与忌口" collapsible open={Boolean(errors.allergyNote)}>
          {field('cuisines', '饮食偏好（用逗号分隔）', <input name="cuisines" value={value.cuisines.join(',')} onChange={(e) => update('cuisines', e.target.value.split(',').map((item) => item.trim()).filter(Boolean))} />)}
          {field('allergyNote', '过敏或忌口备注', <textarea name="allergyNote" maxLength={200} value={value.allergyNote} onChange={(e) => update('allergyNote', e.target.value)} />)}
          <p className="form-note">备注仅用于展示，系统不能可靠排除过敏原，请在用餐前主动向餐厅确认。</p>
        </FormSection>
        <div className="mobile-summary"><ConditionSummary value={value} /></div>
      </div>
      <div className="planner-sidebar"><ConditionSummary value={value} /><button className="primary-button" type="submit">生成行程</button></div>
    </form>
  );
}
