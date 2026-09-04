import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import city from '../../src/data/beijing';
import { DEFAULT_PLANNER_INPUT } from '../../src/domain/defaults';
import { buildTravelPlan } from '../../src/domain/planner';
import { createPlanRepository } from '../../src/storage/planRepository';
import { SavedPlansPage, SavedPlansSection } from '../../src/features/saved-plans/SavedPlansPage';

describe('SavedPlansPage', () => {
  beforeEach(() => localStorage.clear());

  function renderPage() {
    render(<MemoryRouter><SavedPlansPage /></MemoryRouter>);
  }

  function savePlans() {
    const repository = createPlanRepository(localStorage, () => 'copy-id', () => '2026-07-24T00:00:00.000Z');
    const input = { ...DEFAULT_PLANNER_INPUT, origin: '杭州', startDate: '2026-08-01', endDate: '2026-08-03', people: 2 };
    repository.savePlan(buildTravelPlan(input, city, { id: 'older', now: '2026-07-20T00:00:00.000Z' }));
    repository.savePlan({ ...buildTravelPlan(input, city, { id: 'newer', now: '2026-07-23T00:00:00.000Z' }), name: '暑假北京计划' });
    return repository;
  }

  it('按更新时间倒序展示计划所需信息和继续编辑入口', () => {
    savePlans();
    renderPage();
    const cards = screen.getAllByRole('article');
    expect(within(cards[0]).getByRole('heading', { name: '暑假北京计划' })).toBeInTheDocument();
    expect(within(cards[0]).getByText('北京')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/2026-08-01/)).toBeInTheDocument();
    expect(within(cards[0]).getByText(/3 天 · 2 人/)).toBeInTheDocument();
    expect(within(cards[0]).getByText(/预计整组费用/)).toBeInTheDocument();
    expect(within(cards[0]).getByRole('link', { name: '继续编辑' })).toHaveAttribute('href', '/plans/newer');
  });

  it('支持重命名、复制以及经过二次确认后删除', async () => {
    const user = userEvent.setup();
    const repository = savePlans();
    renderPage();
    const firstCard = screen.getAllByRole('article')[0];

    await user.click(within(firstCard).getByRole('button', { name: '重命名计划' }));
    const nameInput = screen.getByRole('textbox', { name: '计划名称' });
    await user.clear(nameInput);
    await user.type(nameInput, '北京毕业旅行');
    await user.click(screen.getByRole('button', { name: '保存新名称' }));
    expect(await screen.findByRole('heading', { name: '北京毕业旅行' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '复制计划' })[0]);
    expect(await screen.findByRole('heading', { name: '北京毕业旅行 - 副本' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '删除计划' })[0]);
    expect(screen.getByRole('dialog', { name: '删除计划' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除计划' }));
    const remaining = repository.listPlans();
    expect(remaining.ok && remaining.value.length).toBe(2);
  });

  it('没有计划时显示说明和新建入口，损坏记录会给出提示', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: '还没有本地计划' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '新建计划' })[0]).toHaveAttribute('href', '/new');

    cleanup();
    localStorage.setItem('light-trip-plans', JSON.stringify([{ broken: true }]));
    render(<MemoryRouter><SavedPlansPage /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('部分本地计划无法加载');
  });

  it('SavedPlansSection 空状态的新建入口可以触发页内滚动回调', async () => {
    const user = userEvent.setup();
    const onCreatePlan = vi.fn();
    render(
      <MemoryRouter>
        <SavedPlansSection embedded onCreatePlan={onCreatePlan} />
      </MemoryRouter>,
    );

    await user.click(within(screen.getByRole('heading', { name: '还没有本地计划' }).closest('section')!).getByRole('button', { name: '新建计划' }));
    expect(onCreatePlan).toHaveBeenCalledTimes(1);
  });
});
