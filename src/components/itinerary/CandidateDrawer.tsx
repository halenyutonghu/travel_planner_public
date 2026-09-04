import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Attraction } from '../../domain/types';
import { trapTabKey } from '../common/focusTrap';

export function CandidateDrawer({ mode = 'replace', initialCandidateId, candidates, excludedIds, areaNames, onConfirm, onClose }: { mode?: 'add' | 'replace'; initialCandidateId?: string; candidates: Attraction[]; excludedIds: string[]; areaNames: Record<string, string>; onConfirm: (candidate: Attraction) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Attraction | null>(() => candidates.find((candidate) => candidate.id === initialCandidateId) ?? null);
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', keydown);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', keydown);
      trigger?.focus();
    };
  }, [onClose]);
  const filtered = useMemo(() => candidates.filter((candidate) =>
    candidate.name.includes(search)
    && (!area || candidate.areaId === area)
    && (!category || candidate.categories.includes(category as Attraction['categories'][number]))
  ), [area, candidates, category, search]);
  return (
    <div className="drawer-backdrop" role="presentation">
      <aside ref={drawerRef} className="candidate-drawer" role="dialog" aria-modal="true" aria-labelledby="candidate-title" onKeyDown={(event) => trapTabKey(event, drawerRef.current)}>
        <header><h2 id="candidate-title">{mode === 'add' ? '选择增加景点' : '选择替换景点'}</h2><button type="button" aria-label="关闭候选列表" onClick={onClose}><X aria-hidden="true" /></button></header>
        <div className="candidate-filters">
          <label>搜索景点<input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label>区域<select value={area} onChange={(event) => setArea(event.target.value)}><option value="">全部区域</option>{Object.entries(areaNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label>兴趣类型<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部类型</option><option value="nature">自然</option><option value="history">历史</option><option value="landmark">地标</option><option value="museum">博物馆</option><option value="food">美食</option><option value="shopping">购物</option><option value="family">亲子</option></select></label>
        </div>
        <div className="candidate-list">{filtered.map((candidate) => <article key={candidate.id} className={selected?.id === candidate.id ? 'is-selected' : ''}><h3>{candidate.name}</h3><p>区域：{areaNames[candidate.areaId] ?? candidate.areaId} · 类型：{candidate.categories.join('、')} · 建议停留 {candidate.durationMinutes} 分钟 · 模拟门票 ¥{candidate.ticketPerPerson}/人</p>{excludedIds.includes(candidate.id) && <p className="candidate-status">此前已排除；主动增加后会移出排除列表</p>}<button type="button" className="secondary-button" disabled={mode === 'replace' && excludedIds.includes(candidate.id)} onClick={() => setSelected(candidate)}>选择该景点</button></article>)}</div>
        <footer>
          {selected ? <p><strong>变更影响预览：</strong>{mode === 'add' ? `将增加“${selected.name}”` : `将使用“${selected.name}”替换原景点`}，费用按 ¥{selected.ticketPerPerson}/人估算。确认后才会修改原计划。</p> : <p>请选择一个候选景点后查看变更影响。</p>}
          <div><button type="button" className="secondary-button" onClick={onClose}>{mode === 'add' ? '取消增加' : '取消替换'}</button><button type="button" className="primary-button" disabled={!selected} onClick={() => selected && onConfirm(selected)}>{mode === 'add' ? '确认增加景点' : '确认替换景点'}</button></div>
        </footer>
      </aside>
    </div>
  );
}
