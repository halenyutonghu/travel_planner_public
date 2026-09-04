import { ArrowDown, ArrowUp, Lock, LockOpen, RefreshCw, Trash2 } from 'lucide-react';
import type { ItineraryItem } from '../../domain/types';

export interface TimelineItemProps {
  item: ItineraryItem;
  onToggleLock: (item: ItineraryItem) => void;
  onDelete: (item: ItineraryItem) => void;
  onReplace: (item: ItineraryItem) => void;
  onMove: (item: ItineraryItem, direction: 'up' | 'down') => void;
  onMoveDate: (item: ItineraryItem, date: string) => void;
  dates: string[];
}

export function TimelineItem({ item, onToggleLock, onDelete, onReplace, onMove, onMoveDate, dates }: TimelineItemProps) {
  return (
    <article className={`timeline-item timeline-item--${item.kind}`}>
      <div className="timeline-item__time">{item.startTime}–{item.endTime}</div>
      <div className="timeline-item__main">
        <div className="timeline-item__title"><h3>{item.name}</h3>{item.state === 'locked' && <span className="locked-badge"><Lock aria-hidden="true" size={14} />已锁定</span>}</div>
        <p>估算费用 ¥{item.cost} · {item.kind === 'attraction' ? '模拟景点数据' : item.kind === 'meal' ? '模拟餐饮数据' : '模拟住宿数据'}</p>
        {item.kind === 'attraction' && <div className="item-actions">
          <button type="button" onClick={() => onReplace(item)} aria-label="替换景点"><RefreshCw aria-hidden="true" size={16} />替换</button>
          <button type="button" onClick={() => onMove(item, 'up')} aria-label="上移景点"><ArrowUp aria-hidden="true" size={16} />上移</button>
          <button type="button" onClick={() => onMove(item, 'down')} aria-label="下移景点"><ArrowDown aria-hidden="true" size={16} />下移</button>
          <label className="move-date-label">移动到日期
            <select aria-label={`移动${item.name}到其他日期`} value={item.date} onChange={(event) => onMoveDate(item, event.target.value)}>
              {dates.map((date) => <option key={date} value={date}>{date}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => onToggleLock(item)} aria-label={item.state === 'locked' ? '解除锁定' : '锁定项目'}>{item.state === 'locked' ? <LockOpen aria-hidden="true" size={16} /> : <Lock aria-hidden="true" size={16} />}{item.state === 'locked' ? '解除锁定' : '锁定'}</button>
          <button type="button" onClick={() => onDelete(item)} aria-label="删除项目"><Trash2 aria-hidden="true" size={16} />删除</button>
        </div>}
      </div>
    </article>
  );
}
