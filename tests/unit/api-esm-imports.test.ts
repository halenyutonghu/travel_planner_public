import { describe, expect, it } from 'vitest';
import diagnosticsSource from '../../api/diagnostics.ts?raw';
import healthSource from '../../api/health.ts?raw';
import versionSource from '../../api/version.ts?raw';

describe('Vercel API ESM imports', () => {
  it('uses runtime-resolvable .js extensions for shared API modules', () => {
    expect(healthSource).toContain("from './diagnostics.js'");
    expect(versionSource).toContain("from './diagnostics.js'");
  });

  it('keeps diagnostic payloads self-contained for Vercel serverless runtime', () => {
    expect(diagnosticsSource).not.toContain("from '../package.json'");
    expect(diagnosticsSource).not.toContain("from '../src/data/data-version'");
  });
});
