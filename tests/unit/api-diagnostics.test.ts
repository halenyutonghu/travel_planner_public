import { describe, expect, it } from 'vitest';
import { createHealthPayload, createVersionPayload } from '../../api/diagnostics';

describe('diagnostic API payloads', () => {
  it('returns the stateless health payload', () => {
    expect(createHealthPayload()).toEqual({
      ok: true,
      service: 'light-trip-planner',
    });
  });

  it('returns version information with environment values when available', () => {
    expect(createVersionPayload({
      VERCEL_GIT_COMMIT_SHA: '8ce372c123456789',
      LIGHT_TRIP_BUILD_TIME: '2026-07-24T00:00:00.000Z',
    })).toEqual({
      appVersion: '1.0.0',
      dataVersion: '1.0.0',
      buildTime: '2026-07-24T00:00:00.000Z',
      commit: '8ce372c123456789',
    });
  });

  it('falls back when optional deployment environment values are missing', () => {
    expect(createVersionPayload({})).toEqual({
      appVersion: '1.0.0',
      dataVersion: '1.0.0',
      buildTime: 'unknown',
      commit: 'unknown',
    });
  });
});
