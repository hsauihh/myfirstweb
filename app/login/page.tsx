// app/login/page.jsx → 网站路径 "/login"
import type { Metadata } from "next";
import AuthView from "../../components/AuthView";

export const metadata: Metadata = {
  title: "登录 · zero to tech",
  description: "登录或注册账号",
};

export default function Page() {
  return <AuthView />;
}
