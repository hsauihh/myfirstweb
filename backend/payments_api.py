"""模拟支付接口：下单、确认支付（开通 VIP）、订单列表。

真实接入微信/支付宝时，把「确认支付」换成网关跳转 + 异步回调，
复用同一段「标记已支付 + 开通 VIP」逻辑即可。
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import payments
import users
from auth import require_user

router = APIRouter(prefix="/api/pay", tags=["pay"])


class OrderRequest(BaseModel):
    product: str = payments.VIP_PRODUCT


@router.get("/orders")
def list_orders_endpoint(request: Request) -> list[dict]:
    user = require_user(request)
    return payments.list_orders(user["id"])


@router.post("/orders", status_code=201)
def create_order_endpoint(req: OrderRequest, request: Request) -> dict:
    user = require_user(request)
    if req.product != payments.VIP_PRODUCT:
        raise HTTPException(status_code=422, detail="未知商品")
    order = payments.create_order(
        user["id"], req.product, payments.VIP_PRICE_CENTS
    )
    return {"order": order}


@router.post("/orders/{order_id}/confirm")
def confirm_order_endpoint(order_id: int, request: Request) -> dict:
    """模拟支付：调用即视为支付成功；已支付则幂等返回，不重复加时。"""
    user = require_user(request)
    order = payments.get_order(user["id"], order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="订单不存在")

    if order["status"] == payments.ORDER_PENDING:
        payments.mark_paid(order_id)
        users.activate_vip(user["id"], payments.VIP_DAYS)

    updated = users.get_user(user["id"])
    return {
        "order": payments.get_order(user["id"], order_id),
        "user": users.public_user(updated),
    }
