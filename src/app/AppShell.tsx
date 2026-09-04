import { useEffect, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import logoUrl from '../assets/light-trip-logo.svg';

export interface AppShellProps {
  children: ReactNode;
}

interface VersionInfo {
  appVersion: string;
  dataVersion: string;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [versionFailed, setVersionFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/version')
      .then((response) => {
        if (!response.ok) throw new Error('Version request failed');
        return response.json() as Promise<VersionInfo>;
      })
      .then((payload) => {
        if (!active) return;
        setVersionInfo({ appVersion: payload.appVersion, dataVersion: payload.dataVersion });
      })
      .catch(() => {
        if (active) setVersionFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  function scrollToHomeSection(id: 'new-plan-section' | 'saved-plans-section') {
    const run = () => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    if (['/', '/new', '/plans'].includes(window.location.pathname)) {
      run();
    } else {
      navigate(id === 'new-plan-section' ? '/new' : '/plans');
      window.setTimeout(run, 0);
    }
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <nav className="topbar__inner" aria-label="主要导航">
          <Link className="brand" to="/">
            <img className="brand__logo" src={logoUrl} alt="" aria-hidden="true" />
            <span>轻途计划</span>
          </Link>
          <div className="desktop-nav">
            <button type="button" onClick={() => scrollToHomeSection('new-plan-section')}>新建计划</button>
            <button type="button" onClick={() => scrollToHomeSection('saved-plans-section')}>本地计划</button>
          </div>
          <button className="mobile-menu" type="button" aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
          </button>
        </nav>
        {menuOpen && <nav id="mobile-navigation" className="mobile-navigation" aria-label="手机导航"><button type="button" onClick={() => scrollToHomeSection('new-plan-section')}>新建计划</button><button type="button" onClick={() => scrollToHomeSection('saved-plans-section')}>本地计划</button></nav>}
      </header>
      <div className="page-container">{children}</div>
      <footer className="app-footer" aria-label="版本信息">
        {versionInfo ? `应用 ${versionInfo.appVersion} · 数据 ${versionInfo.dataVersion}` : versionFailed ? '版本信息暂不可用' : '正在读取版本信息'}
      </footer>
    </div>
  );
}
