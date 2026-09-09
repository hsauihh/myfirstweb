// 模拟支付接口封装：下单、确认支付、订单列表。
import { apiError } from "./apiError.js";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(body, `请求失败：${res.status}`);
  return body;
}

export function createOrder(product = "vip_month") {
  return request("/api/pay/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product }),
  });
}

export function confirmOrder(orderId) {
  return request(`/api/pay/orders/${orderId}/confirm`, { method: "POST" });
}

export function listOrders() {
  return request("/api/pay/orders");
}
