import {
  type ApiRequest,
  type ApiResponse,
  createHealthPayload,
  rejectNonGet,
  sendJson,
} from './diagnostics.js';

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (rejectNonGet(request, response)) return;
  sendJson(response, 200, createHealthPayload());
}
