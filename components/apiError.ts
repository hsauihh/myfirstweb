// 接口错误：带 code / quota 的自定义 Error，catch 里可以直接取用而不必断言。
import type { ApiErrorBody, Quota } from "./types";

export class ApiError extends Error {
  readonly code?: string;
  readonly quota?: Quota | null;

  constructor(message: string, extra: { code?: string; quota?: Quota | null } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = extra.code;
    this.quota = extra.quota;
  }
}

/** 把后端错误响应转成带可读文案的 ApiError，并保留 code / quota 供界面使用。 */
export function apiError(body: unknown, fallback: string): ApiError {
  const payload = (body ?? {}) as ApiErrorBody;
  const detail = payload.detail;
  let message = fallback;
  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail) && detail.length > 0) {
    message = detail[0]?.msg || fallback;
  }
  return new ApiError(message, { code: payload.code, quota: payload.quota });
}
