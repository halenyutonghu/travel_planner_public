import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from '../../src/features/home/HomePage';

describe('HomePage', () => {
  it('显示首屏入口以及两个首页区域', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const hero = screen.getByRole('region', { name: '规划你的下一段行程' });

    expect(within(hero).getByRole('heading', { name: '规划你的下一段行程' })).toBeInTheDocument();
    expect(within(hero).getByRole('button', { name: '新建计划' })).toBeInTheDocument();
    expect(within(hero).getByRole('button', { name: '查看本地计划' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '新建计划' })).toHaveAttribute('id', 'new-plan-section');
    expect(screen.getByRole('region', { name: '本地计划' })).toHaveAttribute('id', 'saved-plans-section');
  });

  it('点击首屏按钮滚动到对应区域', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const hero = screen.getByRole('region', { name: '规划你的下一段行程' });

    await user.click(within(hero).getByRole('button', { name: '查看本地计划' }));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('点击 Travel path 步骤滚动到对应区域', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const path = screen.getByLabelText('旅行路径');

    await user.click(within(path).getByRole('button', { name: /本地管理/ }));
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
