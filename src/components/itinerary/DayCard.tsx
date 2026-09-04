import { useState } from 'react';
import type { ItineraryDay, ItineraryItem } from '../../domain/types';
import { TimelineItem } from './TimelineItem';
import { TransportConnection } from './TransportConnection';

interface DayCardProps {
  day: ItineraryDay;
  index: number;
  dates: string[];
  riskCount: number;
  onToggleLock: (item: ItineraryItem) => void;
  onDelete: (item: ItineraryItem) => void;
  onReplace: (item: ItineraryItem) => void;
  onMove: (item: ItineraryItem, direction: 'up' | 'down') => void;
  onMoveDate: (item: ItineraryItem, date: string) => void;
  onAdd: (date: string) => void;
}

export function DayCard({ day, index, dates, riskCount, onToggleLock, onDelete, onReplace, onMove, onMoveDate, onAdd }: DayCardProps) {
  const mobile = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches;
  const [open, setOpen] = useState(!mobile || index === 0);
  const titleId = `day-${index}-title`;
  const toggleId = `day-${index}-toggle`;
  return (
    <section className="day-card">
      <header className="day-card__header">
        <h2 id={titleId}>第 {index + 1} 天 · {day.date}<small>当日估算 ¥{day.totalCost} · 风险 {riskCount} 条</small></h2>
        <button type="button" aria-expanded={open} aria-labelledby={`${titleId} ${toggleId}`} onClick={() => setOpen((value) => !value)}><span id={toggleId}>{open ? '收起' : '展开'}</span></button>
      </header>
      <div className="day-card__body" hidden={!open}>
        {day.items.map((item) => item.kind === 'transport'
          ? <TransportConnection key={item.id} item={item} />
          : <TimelineItem key={item.id} item={item} dates={dates} onToggleLock={onToggleLock} onDelete={onDelete} onReplace={onReplace} onMove={onMove} onMoveDate={onMoveDate} />)}
        <p className="rest-summary">{day.restHours === null ? '本日之后无住宿休息时长' : `预计休息 ${day.restHours} 小时`}</p>
        <button type="button" className="secondary-button add-attraction-button" onClick={() => onAdd(day.date)}>增加景点到这一天</button>
      </div>
    </section>
  );
}
