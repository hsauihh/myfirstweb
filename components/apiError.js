// 把后端错误响应转成带可读文案的 Error，并保留 code / quota 供界面使用。
export function apiError(body, fallback) {
  const detail = body?.detail;
  let message = fallback;
  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail) && detail.length > 0) {
    message = detail[0].msg || fallback;
  }
  const error = new Error(message);
  error.code = body?.code;
  error.quota = body?.quota;
  return error;
}
