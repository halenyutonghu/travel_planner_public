import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import city from '../../src/data/beijing';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';
import { buildTravelPlan } from '../../src/domain/planner';
import { createPlanRepository } from '../../src/storage/planRepository';
import { ItineraryPage } from '../../src/features/itinerary/ItineraryPage';

describe('ItineraryPage', () => {
  beforeEach(() => {
    localStorage.clear();
    const input = { ...DEFAULT_PLANNER_INPUT, origin: '杭州', startDate: '2026-08-01', endDate: '2026-08-03' };
    createPlanRepository(localStorage).savePlan(buildTravelPlan(input, city, { id: 'p1', now: '2026-07-23T00:00:00.000Z' }));
  });

  function renderPage() {
    render(<MemoryRouter initialEntries={['/plans/p1']}><Routes><Route path="/plans/:planId" element={<ItineraryPage />} /></Routes></MemoryRouter>);
  }

  it('显示模拟声明、费用摘要、每日行程和交通连接', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: '北京 2026-08-01' })).toBeInTheDocument();
    expect(screen.getByText('模拟数据，仅供演示')).toBeInTheDocument();
    expect(screen.getByText('预计整组费用')).toBeInTheDocument();
    expect(screen.getAllByText('区域间模拟交通').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/步行|公共交通|出租车\/网约车/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/walk|publicTransit|taxi/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /第 1 天/ })).toBeInTheDocument();
  });

  it('可以锁定并删除景点，删除后写入排除列表', async () => {
    const user = userEvent.setup();
    renderPage();
    const lockButtons = await screen.findAllByRole('button', { name: '锁定项目' });
    await user.click(lockButtons[0]);
    expect(screen.getAllByText('已锁定').length).toBeGreaterThan(0);
    const deleteButtons = screen.getAllByRole('button', { name: '删除项目' });
    await user.click(deleteButtons[0]);
    await user.click(screen.getByRole('button', { name: '确认删除项目' }));
    await waitFor(() => {
      const saved = createPlanRepository(localStorage).getPlan('p1');
      expect(saved.ok && saved.value?.excludedIds.length).toBe(1);
    });
  });

  it('可以上移景点，手动调整后自动锁定并保存', async () => {
    const user = userEvent.setup();
    renderPage();
    const moveUpButtons = await screen.findAllByRole('button', { name: '上移景点' });
    await user.click(moveUpButtons[1]);
    await waitFor(() => {
      const saved = createPlanRepository(localStorage).getPlan('p1');
      expect(saved.ok && saved.value?.days[0].items.some((item) => item.state === 'locked')).toBe(true);
    });
  });

  it('可以预览并确认替换景点，确认前不修改计划', async () => {
    const user = userEvent.setup();
    renderPage();
    const before = createPlanRepository(localStorage).getPlan('p1');
    const originalSourceId = before.ok ? before.value?.days[0].items.find((item) => item.kind === 'attraction')?.sourceId : undefined;

    const replaceButtons = await screen.findAllByRole('button', { name: '替换景点' });
    await user.click(replaceButtons[0]);
    expect(screen.getByRole('dialog', { name: '选择替换景点' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: '选择该景点' })[0]);
    expect(screen.getByText(/确认后才会修改原计划/)).toBeInTheDocument();

    const unchanged = createPlanRepository(localStorage).getPlan('p1');
    expect(unchanged.ok && unchanged.value?.days[0].items.some((item) => item.sourceId === originalSourceId)).toBe(true);

    await user.click(screen.getByRole('button', { name: '确认替换景点' }));
    await waitFor(() => {
      const saved = createPlanRepository(localStorage).getPlan('p1');
      expect(saved.ok && saved.value?.days[0].items.some((item) => item.sourceId === originalSourceId)).toBe(false);
      expect(saved.ok && saved.value?.days[0].items.some((item) => item.kind === 'attraction' && item.state === 'locked')).toBe(true);
    });
  });
});
