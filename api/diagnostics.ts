const APP_VERSION = '1.0.0';
const DATA_VERSION = '1.0.0';

export interface HealthPayload {
  ok: true;
  service: 'light-trip-planner';
}

export interface VersionPayload {
  appVersion: string;
  dataVersion: string;
  buildTime: string;
  commit: string;
}

export interface ApiRequest {
  method?: string;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): ApiResponse;
  json(payload: unknown): ApiResponse;
  end(): ApiResponse;
}

export function createHealthPayload(): HealthPayload {
  return {
    ok: true,
    service: 'light-trip-planner',
  };
}

export function createVersionPayload(env: Record<string, string | undefined> = {}): VersionPayload {
  return {
    appVersion: APP_VERSION,
    dataVersion: DATA_VERSION,
    buildTime: env.LIGHT_TRIP_BUILD_TIME ?? 'unknown',
    commit: env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
  };
}

export function sendJson(response: ApiResponse, statusCode: number, payload: unknown): void {
  response
    .status(statusCode)
    .setHeader('Content-Type', 'application/json; charset=utf-8')
    .json(payload);
}

export function rejectNonGet(request: ApiRequest, response: ApiResponse): boolean {
  if (request.method === 'GET') return false;
  response
    .status(405)
    .setHeader('Allow', 'GET')
    .setHeader('Content-Type', 'application/json; charset=utf-8')
    .json({ error: 'Method Not Allowed' });
  return true;
}

export function getRuntimeEnv(): Record<string, string | undefined> {
  const globalWithProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return globalWithProcess.process?.env ?? {};
}
