import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';


function expectMeta(name: string, content: string) {
  expect(html).toContain(`<meta name="${name}" content="${content}" />`);
}

function expectProperty(property: string, content: string) {
  expect(html).toContain(`<meta property="${property}" content="${content}" />`);
}

describe('index.html metadata', () => {
  it('provides basic SEO metadata for the static deployment', () => {
    expect(html).toContain('<title>轻途计划｜本地优先旅行计划工具</title>');
    expectMeta('description', '使用项目内模拟数据生成可编辑的本地旅行计划。计划默认只保存在当前浏览器，出行前请通过官方渠道核实价格、营业时间、交通和安全信息。');
    expectMeta('robots', 'index,follow');
    expectMeta('theme-color', '#f7f4ee');
  });

  it('provides social sharing metadata', () => {
    expectProperty('og:type', 'website');
    expectProperty('og:site_name', '轻途计划');
    expectProperty('og:title', '轻途计划｜本地优先旅行计划工具');
    expectProperty('og:description', '使用项目内模拟数据生成可编辑的本地旅行计划。计划默认只保存在当前浏览器。');
    expectMeta('twitter:card', 'summary');
    expectMeta('twitter:title', '轻途计划｜本地优先旅行计划工具');
    expectMeta('twitter:description', '使用项目内模拟数据生成可编辑的本地旅行计划。计划默认只保存在当前浏览器。');
  });
});
