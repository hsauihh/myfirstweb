"use client";

// 首页「随心一记」快入口：记一句话就进个人知识库，下面列最近几条（可删）。
// 完整管理（分页、全量列表）仍在 /knowledge 的「随心一记」页签。
// 未登录时只显示一行提示，不发任何请求。
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { errorMessage } from "./apiError";
import { useAuth } from "./AuthContext";
import * as kbApi from "./kbApi";
import type { KbNote } from "./types";

const RECENT = 3;

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} 小时前`;
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

export default function HomeNotes() {
  const { user, loading } = useAuth();
  const [notes, setNotes] = useState<KbNote[]>([]);
  const [total, setTotal] = useState(0);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const reload = useCallback(async () => {
    const data = await kbApi.listNotes(RECENT, 0);
    setNotes(data.items);
    setTotal(data.total);
  }, []);

  useEffect(() => {
    if (!user) {
      setNotes([]);
      setTotal(0);
      return undefined;
    }
    let alive = true;
    reload().catch((err) => alive && setError(errorMessage(err)));
    return () => {
      alive = false;
    };
  }, [user, reload]);

  // 输入框跟随内容长高，最多 3 行
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 84)}px`;
  }, [text]);

  async function save() {
    const content = text.trim();
    if (!content || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await kbApi.addNote(content);
      setText("");
      setMessage("已记下，问答里能查到");
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(note: KbNote) {
    if (!window.confirm("删除这条笔记？删除后问答就查不到它了。")) return;
    setError("");
    try {
      await kbApi.removeNote(note.id);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <p className="home-note-login">
        <Link href="/login">登录</Link> 后可以把一句话记进知识库，随时问 AI。
      </p>
    );
  }

  return (
    <>
      <div className="home-note-field">
        <textarea
          ref={inputRef}
          className="home-note-input"
          rows={1}
          maxLength={kbApi.NOTE_MAX_LENGTH}
          placeholder="记一句…（Enter 保存，Shift+Enter 换行）"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void save();
            }
          }}
        />
        <button
          type="button"
          className="home-note-save"
          disabled={saving || !text.trim()}
          onClick={() => void save()}
        >
          {saving ? "保存中…" : "记下"}
        </button>
      </div>
      <p className="home-note-status" role="status">
        {error || message || (total > 0 ? `已记 ${total} 条` : "还没有笔记，记一条试试")}
      </p>
      {notes.length > 0 && (
        <ul className="home-note-list">
          {notes.map((note) => (
            <li key={note.id} className="home-note-row">
              <span className="home-note-row__text">{note.content}</span>
              <span className="home-note-row__time">{formatTime(note.created_at)}</span>
              <button
                type="button"
                className="home-note-row__remove"
                aria-label="删除这条笔记"
                onClick={() => void remove(note)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {total > notes.length && (
        <Link className="home-more" href="/knowledge#notes">
          全部 {total} 条 →
        </Link>
      )}
    </>
  );
}
