import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlannerForm } from '../../src/features/planner/PlannerForm';
import { PlannerPage, PlannerSection } from '../../src/features/planner/PlannerPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

describe('PlannerForm', () => {
  it('显示单页分组表单和默认折叠的高级分组', () => {
    render(<PlannerForm onGenerate={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '基本信息' })).toBeInTheDocument();
    expect(screen.getByText('房间与住宿').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('往返及市内交通').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('饮食与忌口').closest('details')).not.toHaveAttribute('open');
  });

  it('必填栏目排列在选填栏目上方', () => {
    const { container } = render(<PlannerForm onGenerate={vi.fn()} />);

    const headings = Array.from(container.querySelectorAll('.planner-form .form-section h2')).map((heading) => heading.textContent);
    expect(headings).toEqual(['基本信息', '预算与消费档次', '景点兴趣', '行程强度与休息', '房间与住宿', '往返及市内交通', '饮食与忌口']);
  });

  it('PlannerSection 可以作为首页区域渲染新建表单', () => {
    render(
      <MemoryRouter>
        <PlannerSection embedded />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '新建旅行计划' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成行程' })).toBeInTheDocument();
  });

  it('选填分组悬浮时自动展开，移开后自动收起', async () => {
    const user = userEvent.setup();
    render(<PlannerForm onGenerate={vi.fn()} />);
    const section = screen.getByText('房间与住宿').closest('details');
    expect(section).not.toHaveAttribute('open');
    await user.hover(screen.getByText('房间与住宿'));
    expect(section).toHaveAttribute('open');
    await user.unhover(screen.getByText('房间与住宿'));
    await waitFor(() => expect(section).not.toHaveAttribute('open'));
  });

  it('选填分组点击后保持展开', async () => {
    const user = userEvent.setup();
    render(<PlannerForm onGenerate={vi.fn()} />);
    const summary = screen.getByText('往返及市内交通').closest('summary')!;
    const section = summary.closest('details');
    await user.hover(summary);
    await user.click(summary);
    await user.unhover(summary);
    expect(section).toHaveAttribute('open');
  });

  it('有效填写后提交完整条件', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(<PlannerForm onGenerate={onGenerate} />);
    await user.type(screen.getByLabelText('出发地'), '杭州');
    await user.type(screen.getByLabelText('开始日期'), '2026-08-01');
    await user.type(screen.getByLabelText('结束日期'), '2026-08-03');
    await user.click(screen.getByRole('button', { name: '生成行程' }));
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ origin: '杭州', people: 1, destination: 'beijing', spendingTier: 'comfortable', intensity: 'moderate' }));
  });

  it('景点兴趣使用三段按钮并提交不喜欢偏好', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(<PlannerForm onGenerate={onGenerate} />);
    await user.click(screen.getByRole('button', { name: '自然风光 不喜欢' }));
    await user.type(screen.getByLabelText('出发地'), '杭州');
    await user.type(screen.getByLabelText('开始日期'), '2026-08-01');
    await user.type(screen.getByLabelText('结束日期'), '2026-08-03');
    await user.click(screen.getByRole('button', { name: '生成行程' }));
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ interests: expect.objectContaining({ nature: 'disliked' }) }));
  });

  it('无效提交时显示错误并聚焦第一个字段', async () => {
    const user = userEvent.setup();
    render(<PlannerForm onGenerate={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '生成行程' }));
    expect(screen.getByText('请填写出发地')).toBeInTheDocument();
    expect(screen.getByLabelText('出发地')).toHaveFocus();
  });

  it('生成成功后自动保存并进入详情页', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/new']}>
        <Routes>
          <Route path="/new" element={<PlannerPage />} />
          <Route path="/plans/:planId" element={<div>行程已经生成</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('出发地'), '杭州');
    await user.type(screen.getByLabelText('开始日期'), '2026-08-01');
    await user.type(screen.getByLabelText('结束日期'), '2026-08-03');
    await user.click(screen.getByRole('button', { name: '生成行程' }));
    expect(await screen.findByText('行程已经生成')).toBeInTheDocument();
    expect(localStorage.getItem('light-trip-plans')).toContain('杭州');
  });

  it('新建页明确提示计划只保存在当前浏览器', () => {
    render(
      <MemoryRouter initialEntries={['/new']}>
        <Routes>
          <Route path="/new" element={<PlannerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/计划只保存在当前浏览器/)).toBeInTheDocument();
  });
});
