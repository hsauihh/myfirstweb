// app/login/page.jsx → 网站路径 "/login"
import AuthView from "../../components/AuthView";

export const metadata = {
  title: "登录 · zero to tech",
  description: "登录或注册账号",
};

export default function Page() {
  return <AuthView />;
}
