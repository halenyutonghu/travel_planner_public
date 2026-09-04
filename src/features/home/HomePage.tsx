import { useEffect, useRef } from 'react';
import { PlannerSection } from '../planner/PlannerPage';
import { SavedPlansSection } from '../saved-plans/SavedPlansPage';
import './home.css';

export type HomeSectionId = 'new-plan' | 'saved-plans';

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function HomePage({ initialSection }: { initialSection?: HomeSectionId }) {
  const newPlanRef = useRef<HTMLElement>(null);
  const savedPlansRef = useRef<HTMLElement>(null);

  function scrollToSection(section: HomeSectionId) {
    const target = section === 'new-plan' ? newPlanRef.current : savedPlansRef.current;
    target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  useEffect(() => {
    if (initialSection) window.requestAnimationFrame(() => scrollToSection(initialSection));
  }, [initialSection]);

  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <p className="home-hero__eyebrow">轻途计划</p>
          <h1 id="home-title">规划你的下一段行程</h1>
          <p>生成后在本地持续编辑和管理。</p>
          <div className="home-hero__actions">
            <button className="primary-button" type="button" onClick={() => scrollToSection('new-plan')}>新建计划</button>
            <button className="secondary-button" type="button" onClick={() => scrollToSection('saved-plans')}>查看本地计划</button>
          </div>
        </div>
        <aside className="home-path-card" aria-label="旅行路径">
          <span className="home-path-card__label">Travel path</span>
          <ol className="home-path-card__steps">
            <li><button type="button" onClick={() => scrollToSection('new-plan')}><span>1</span><strong>填写条件</strong><em>开始</em></button></li>
            <li><button type="button" onClick={() => scrollToSection('new-plan')}><span>2</span><strong>生成行程</strong><em>模拟数据</em></button></li>
            <li><button type="button" onClick={() => scrollToSection('saved-plans')}><span>3</span><strong>本地管理</strong><em>可编辑</em></button></li>
          </ol>
          <div className="home-path-card__stats">
            <div><strong>5</strong><span>个城市</span></div>
            <div><strong>本地</strong><span>浏览器保存</span></div>
          </div>
        </aside>
      </section>
      <section id="new-plan-section" ref={newPlanRef} className="home-section" aria-label="新建计划">
        <PlannerSection embedded />
      </section>
      <section id="saved-plans-section" ref={savedPlansRef} className="home-section" aria-label="本地计划">
        <SavedPlansSection embedded onCreatePlan={() => scrollToSection('new-plan')} />
      </section>
    </main>
  );
}
