// 接口请求的唯一入口：所有 *Api 模块共用，把 fetch、JSON 解析与错误转换收在一处。
//
// 唯一的类型未校验缝隙就是下面那句 `body as T`：后端是本项目自己的，契约由后端源码保证，
// 所以本次不引运行时校验库（要防跨服务字段漂移时再补 zod 之类的守卫）。
import { apiError } from "./apiError";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export { API_BASE as API };

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options });
  const body = await readJson(res);
  if (!res.ok) throw apiError(body, `请求失败：${res.status}`);
  return body as T;
}

/** 给请求补上 JSON 头的 options（保持与原来各模块 json() 相同的覆盖语义）。 */
export function jsonRequest(options: RequestInit): RequestInit {
  return { ...options, headers: { "Content-Type": "application/json" } };
}
