"use client";

// 登录 / 注册表单：先做本地校验，再交给上层提交。
import { useState, type FormEvent } from "react";
import { errorMessage } from "./apiError";

const PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{2,19}$/;

function validate(username: string, password: string) {
  if (!USERNAME_PATTERN.test(username)) {
    return "用户名需为 3-20 位字母、数字或下划线，且以字母开头";
  }
  if (password.length !== PASSWORD_LENGTH) {
    return `密码需为 ${PASSWORD_LENGTH} 位字符`;
  }
  if (/\s/.test(password)) {
    return "密码不能包含空白字符";
  }
  return "";
}

interface AuthFormProps {
  mode: "login" | "register";
  submitLabel: string;
  onSubmit: (username: string, password: string) => Promise<void>;
}

export default function AuthForm({ mode, submitLabel, onSubmit }: AuthFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validate(username, password);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onSubmit(username, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label htmlFor={`auth-username-${mode}`}>用户名</label>
      <input
        id={`auth-username-${mode}`}
        type="text"
        autoComplete="username"
        placeholder="字母开头，3-20 位"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <label htmlFor={`auth-password-${mode}`}>密码</label>
      <input
        id={`auth-password-${mode}`}
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        maxLength={PASSWORD_LENGTH}
        placeholder="恰好 8 位字符"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="auth-hint">密码为 8 位字符，不含空格</p>
      {error && <p className="lab-error">{error}</p>}
      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? "提交中…" : submitLabel}
      </button>
    </form>
  );
}
