import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../src/app/routes';

describe('AppRoutes', () => {
  it.each(['/', '/new', '/plans'])('%s 渲染合并首页', (path) => {
    render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: '规划你的下一段行程' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '新建计划' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '本地计划' })).toBeInTheDocument();
  });
});
