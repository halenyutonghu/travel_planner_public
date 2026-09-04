import { describe, expect, it, vi } from 'vitest';
import healthHandler from '../../api/health';
import versionHandler from '../../api/version';

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
}

describe('diagnostic API functions', () => {
  it('serves GET /api/health as JSON', () => {
    const response = createResponse();

    healthHandler({ method: 'GET' }, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    expect(response.json).toHaveBeenCalledWith({ ok: true, service: 'light-trip-planner' });
  });

  it('serves GET /api/version as JSON', () => {
    const response = createResponse();

    versionHandler({ method: 'GET' }, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    expect(response.json).toHaveBeenCalledWith({
      appVersion: '1.0.0',
      dataVersion: '1.0.0',
      buildTime: 'unknown',
      commit: 'unknown',
    });
  });

  it('rejects non-GET requests', () => {
    const response = createResponse();

    healthHandler({ method: 'POST' }, response);

    expect(response.status).toHaveBeenCalledWith(405);
    expect(response.setHeader).toHaveBeenCalledWith('Allow', 'GET');
    expect(response.json).toHaveBeenCalledWith({ error: 'Method Not Allowed' });
  });
});
