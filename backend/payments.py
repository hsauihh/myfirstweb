"""模拟支付订单存储层。"""
import sqlite3

import db

VIP_PRODUCT = "vip_month"
VIP_PRICE_CENTS = 99900
VIP_DAYS = 30
ORDER_PENDING = "pending"
ORDER_PAID = "paid"


def _order(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "product": row["product"],
        "amount_cents": row["amount_cents"],
        "status": row["status"],
        "created_at": row["created_at"],
        "paid_at": row["paid_at"],
    }


def create_order(user_id: int, product: str, amount_cents: int) -> dict:
    now = db.now_iso()
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO orders (user_id, product, amount_cents, status, created_at)"
        " VALUES (?, ?, ?, ?, ?)",
        [user_id, product, amount_cents, ORDER_PENDING, now],
    )
    conn.commit()
    order_id = cur.lastrowid
    conn.close()
    return {
        "id": order_id,
        "product": product,
        "amount_cents": amount_cents,
        "status": ORDER_PENDING,
        "created_at": now,
        "paid_at": None,
    }


def get_order(user_id: int, order_id: int) -> dict | None:
    conn = db.get_conn()
    row = conn.execute(
        "SELECT * FROM orders WHERE id = ? AND user_id = ?", [order_id, user_id]
    ).fetchone()
    conn.close()
    return _order(row) if row else None


def mark_paid(order_id: int) -> None:
    conn = db.get_conn()
    conn.execute(
        "UPDATE orders SET status = ?, paid_at = ? WHERE id = ?",
        [ORDER_PAID, db.now_iso(), order_id],
    )
    conn.commit()
    conn.close()


def list_orders(user_id: int) -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", [user_id]
    ).fetchall()
    conn.close()
    return [_order(row) for row in rows]
