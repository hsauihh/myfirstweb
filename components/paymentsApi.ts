// 模拟支付接口封装：下单、确认支付、订单列表。
import { apiRequest, jsonRequest } from "./apiRequest";
import type { Order, PublicUser } from "./types";

export function createOrder(product = "vip_month") {
  return apiRequest<{ order: Order }>(
    "/api/pay/orders",
    jsonRequest({ method: "POST", body: JSON.stringify({ product }) })
  );
}

export function confirmOrder(orderId: number | string) {
  return apiRequest<{ order: Order; user: PublicUser }>(
    `/api/pay/orders/${orderId}/confirm`,
    { method: "POST" }
  );
}

export function listOrders() {
  return apiRequest<Order[]>("/api/pay/orders");
}
