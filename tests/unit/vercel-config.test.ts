import { describe, expect, it } from 'vitest';
import vercelConfig from '../../vercel.json';

describe('vercel routing config', () => {
  it('keeps SPA fallback from matching API routes', () => {
    expect(vercelConfig.rewrites).toEqual([
      {
        source: '/((?!api/).*)',
        destination: '/index.html',
      },
    ]);
  });
});
