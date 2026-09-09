"use client";

// 登录页视图：登录 / 注册 Tab + 表单；成功后回到文字实验室。
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthForm from "./AuthForm.jsx";
import { useAuth } from "./AuthContext.jsx";

const MODES = [
  { id: "login", label: "登录", submitLabel: "登录" },
  { id: "register", label: "注册", submitLabel: "注册并登录" },
];

export default function AuthView() {
  const router = useRouter();
  const auth = useAuth();
  const [mode, setMode] = useState("login");

  async function handleSubmit(username, password) {
    if (mode === "register") {
      await auth.register(username, password);
    } else {
      await auth.login(username, password);
    }
    router.push("/text-lab");
  }

  const current = MODES.find((item) => item.id === mode);

  return (
    <div className="auth-card">
      <p className="section-kicker">账号</p>
      <h1 className="auth-title">
        {mode === "login" ? "欢迎回来" : "创建账号"}
      </h1>
      <div className="auth-tabs" role="tablist" aria-label="登录或注册">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            className={"lab-tab" + (mode === item.id ? " is-active" : "")}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <AuthForm
        key={mode}
        mode={mode}
        submitLabel={current.submitLabel}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
