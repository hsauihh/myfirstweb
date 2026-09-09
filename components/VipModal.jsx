"use client";

// 模拟支付弹窗：点微信 / 支付宝即视为支付成功并开通 VIP。
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { confirmOrder, createOrder } from "./paymentsApi.js";

const PRICE_YUAN = "999";

export default function VipModal({ open, onClose }) {
  const { refresh } = useAuth();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function pay(channel) {
    setBusy(channel);
    setMessage("");
    try {
      const { order } = await createOrder();
      await confirmOrder(order.id);
      await refresh();
      setMessage("支付成功，已开通「至尊无敌黄金VIP」");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel vip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <p className="section-kicker">会员</p>
            <h3>至尊无敌黄金VIP</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            关闭
          </button>
        </div>

        <p className="vip-price">{PRICE_YUAN} 元 / 月</p>
        <p className="vip-desc">开通后 AI 对话不限量，到期自动回到每天 20 条。</p>

        <div className="vip-channels">
          <button
            type="button"
            className="primary-button"
            disabled={Boolean(busy)}
            onClick={() => pay("wechat")}
          >
            {busy === "wechat" ? "支付中…" : "微信支付"}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={Boolean(busy)}
            onClick={() => pay("alipay")}
          >
            {busy === "alipay" ? "支付中…" : "支付宝"}
          </button>
        </div>

        <p className="vip-hint">开通后立即生效，到期自动回到每日免费额度。</p>
        {message && <p className="vip-hint">{message}</p>}
      </div>
    </div>
  );
}
