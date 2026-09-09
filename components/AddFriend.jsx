"use client";

// 添加好友：用户名精确搜索 / 好友码；展示自己的好友码与邀请链接。
import { useEffect, useState } from "react";
import { lookup, myCode } from "./friendsApi.js";

const RELATION_LABELS = {
  self: "这是你自己",
  friends: "已经是好友",
  request_sent: "已发送申请，等待对方通过",
  request_received: "对方已申请，去系统通知接受",
  none: "",
};

export default function AddFriend({ onAdd, presetCode }) {
  const [mode, setMode] = useState("username");
  const [value, setValue] = useState("");
  const [found, setFound] = useState(null);
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    myCode()
      .then((data) => setCode(data.code))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!presetCode) return;
    setMode("code");
    setValue(presetCode);
    search("code", presetCode);
  }, [presetCode]);

  async function search(searchMode = mode, searchValue = value) {
    const trimmed = searchValue.trim();
    if (!trimmed) return;
    setMessage("");
    setFound(null);
    try {
      const data = await lookup(
        searchMode === "code" ? { code: trimmed } : { username: trimmed }
      );
      setFound(data);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function send() {
    if (!found) return;
    const payload =
      mode === "code" ? { code: value.trim() } : { username: value.trim() };
    const outcome = await onAdd(payload);
    if (!outcome.ok) {
      setMessage(outcome.message);
      return;
    }
    setMessage(
      outcome.result.status === "friends" ? "你们已经成为好友" : "好友申请已发送"
    );
    setFound(null);
    setValue("");
  }

  const inviteLink = code && origin ? `${origin}/messages?code=${code}` : "";

  function copyInvite() {
    if (!inviteLink) return;
    navigator.clipboard?.writeText(inviteLink).then(
      () => setMessage("邀请链接已复制"),
      () => setMessage("复制失败，请手动复制")
    );
  }

  return (
    <div className="add-friend-body">
      <div className="add-tabs">
        {["username", "code"].map((item) => (
          <button
            key={item}
            type="button"
            className={"lab-tab" + (mode === item ? " is-active" : "")}
            onClick={() => {
              setMode(item);
              setFound(null);
              setMessage("");
            }}
          >
            {item === "username" ? "用户名" : "好友码"}
          </button>
        ))}
      </div>

      <div className="add-row">
        <input
          type="text"
          value={value}
          placeholder={mode === "username" ? "输入完整用户名" : "输入 8 位好友码"}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
        />
        <button type="button" className="ghost-button" onClick={() => search()}>
          查找
        </button>
      </div>

      {found && (
        <div className="add-result">
          <span className="request-name">{found.user.username}</span>
          <span className="add-relation">{RELATION_LABELS[found.relationship]}</span>
          {found.relationship === "none" && (
            <button type="button" className="ghost-button" onClick={send}>
              加好友
            </button>
          )}
        </div>
      )}

      {message && <p className="add-friend-hint">{message}</p>}

      <div className="invite-row">
        <span className="add-friend-hint">我的好友码：{code || "…"}</span>
        <button
          type="button"
          className="ghost-button"
          onClick={copyInvite}
          disabled={!inviteLink}
        >
          复制邀请链接
        </button>
      </div>
    </div>
  );
}
