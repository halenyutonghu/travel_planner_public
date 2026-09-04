import { ArrowDown } from 'lucide-react';
import type { ItineraryItem, TransportMode } from '../../domain/types';

const transportModeLabels: Record<TransportMode, string> = {
  flight: '飞机',
  train: '高铁/火车',
  selfDrive: '自驾',
  publicTransit: '公共交通',
  walk: '步行',
  taxi: '出租车/网约车',
};

function formatTransportMode(mode: unknown): string {
  return typeof mode === 'string' && mode in transportModeLabels ? transportModeLabels[mode as TransportMode] : '';
}

export function TransportConnection({ item }: { item: ItineraryItem }) {
  return (
    <div className="transport-connection">
      <ArrowDown aria-hidden="true" size={18} />
      <div><strong>{item.name}</strong><span>{formatTransportMode(item.metadata?.mode)} · 约 {Number(item.metadata?.distanceKm ?? 0)} km · {item.startTime}–{item.endTime}</span></div>
    </div>
  );
}
