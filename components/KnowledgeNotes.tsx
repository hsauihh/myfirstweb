"use client";

// 随心一记：一句话笔记（钥匙放哪、待办、灵感…），存进个人知识库后即可在问答里问到。
// 这里导出两个东西：
//   NotesPanel —— 页签内容（输入 + 列表）；
//   NoteList   —— 只有列表，来源管理页复用同一条列表（避免两份实现各自不同步）。
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "./apiError";
import { useAuth } from "./AuthContext";
import * as kbApi from "./kbApi";
import type { KbNote } from "./types";

const MAX_LENGTH = kbApi.NOTE_MAX_LENGTH;

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface NoteListProps {
  /** 变化时重新拉取（新增/删除后由外层 +1，保证各面板同步）。 */
  nonce?: number;
  onChanged?: () => void;
  /** 空列表时的提示。 */
  empty?: string;
}

export function NoteList({ nonce = 0, onChanged, empty }: NoteListProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<KbNote[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (offset: number) => {
    const data = await kbApi.listNotes(kbApi.NOTE_PAGE_SIZE, offset);
    setItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
    setTotal(data.total);
    setHasMore(data.has_more);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    setLoading(true);
    load(0)
      .then(() => alive && setError(""))
      .catch((err) => alive && setError(errorMessage(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user, load, nonce]);

  async function remove(note: KbNote) {
    if (!window.confirm("删除这条笔记？删除后问答就查不到它了。")) return;
    setBusyId(note.id);
    setError("");
    try {
      await kbApi.removeNote(note.id);
      setItems((prev) => prev.filter((item) => item.id !== note.id));
      setTotal((prev) => Math.max(prev - 1, 0));
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="blog-empty">笔记加载中…</p>;

  return (
    <div className="kb-notes">
      {error && <p className="lab-error">{error}</p>}
      {items.length === 0 ? (
        <p className="blog-empty">{empty ?? "还没有笔记，记一条试试。"}</p>
      ) : (
        <>
          <p className="kb-notes__count">共 {total} 条</p>
          <ul className="kb-note-list">
            {items.map((note) => (
              <li key={note.id} className="kb-note">
                <p className="kb-note__content">{note.content}</p>
                <div className="kb-note__meta">
                  <span>{formatTime(note.created_at)}</span>
                  <span>{note.chunks} 个片段</span>
                  <button
                    type="button"
                    className="link-button"
                    disabled={busyId === note.id}
                    onClick={() => remove(note)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              className="btn btn-outline kb-notes__more"
              onClick={() => void load(items.length)}
            >
              加载更多
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface NotesPanelProps {
  nonce?: number;
  onChanged?: () => void;
}

export default function NotesPanel({ nonce = 0, onChanged }: NotesPanelProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [localNonce, setLocalNonce] = useState(0);

  const canSave = text.trim().length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await kbApi.addNote(text);
      setText("");
      setMessage("已记下，现在就能在下面的问答里问到。");
      setLocalNonce((value) => value + 1);
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="panel panel-full card kb-note-panel">
        <p className="section-kicker">随心一记</p>
        <h2 className="kb-section__title">记一句话，存进知识库</h2>
        <p className="kb-note-panel__hint">
          比如「钥匙放在玄关柜第二层」——之后直接问 AI 就行，不用自己记。
        </p>
        <textarea
          className="kb-note-panel__input"
          rows={2}
          maxLength={MAX_LENGTH}
          placeholder="记点什么…（Ctrl/Cmd + Enter 保存）"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
        />
        <div className="kb-note-panel__bar">
          <span className="kb-note-panel__count">
            {text.length}/{MAX_LENGTH}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSave}
            onClick={() => void save()}
          >
            {saving ? "保存中…" : "记下"}
          </button>
        </div>
        {message && <p className="kb-note-panel__ok">{message}</p>}
        {error && <p className="lab-error">{error}</p>}
      </div>

      <div className="panel panel-full card">
        <div className="kb-section__head">
          <h2 className="kb-section__title">我的笔记</h2>
        </div>
        <NoteList
          nonce={nonce + localNonce}
          onChanged={onChanged}
          empty="还没有笔记。上面写一句，就会立刻进知识库。"
        />
      </div>
    </>
  );
}
