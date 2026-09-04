import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../../src/app/AppShell';

describe('AppShell', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('显示产品导航和页面内容', () => {
    render(
      <MemoryRouter>
        <AppShell><main>页面内容</main></AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText('轻途计划')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建计划' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '本地计划' })).toBeInTheDocument();
    expect(screen.getByText('页面内容')).toBeInTheDocument();
  });

  it('从诊断接口显示应用版本和数据版本', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        appVersion: '1.0.0',
        dataVersion: '1.0.0',
        buildTime: '2026-07-24T00:00:00.000Z',
        commit: '8ce372c',
      }),
    }));

    render(
      <MemoryRouter>
        <AppShell><main>页面内容</main></AppShell>
      </MemoryRouter>,
    );

    expect(await screen.findByText('应用 1.0.0 · 数据 1.0.0')).toBeInTheDocument();
  });

  it('版本接口失败时显示非阻断 fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(
      <MemoryRouter>
        <AppShell><main>页面内容</main></AppShell>
      </MemoryRouter>,
    );

    expect(await screen.findByText('版本信息暂不可用')).toBeInTheDocument();
    expect(screen.getByText('页面内容')).toBeInTheDocument();
  });
});
