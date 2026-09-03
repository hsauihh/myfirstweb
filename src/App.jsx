import HomePage from "./components/HomePage.jsx";
import TextLabPage from "./components/TextLabPage.jsx";
import { useRoute } from "./router/useRoute.js";

export default function App() {
  // 4.3 里"现在在哪一页"记在内存（useState）里——一刷新就被打回首页。
  // 这一节换成 useRoute：把"在哪一页"读自 / 写入浏览器地址栏。
  const { path, navigate } = useRoute();

  // 看地址栏决定显示哪一页：/text-lab → 文字实验室；其它（含 /）→ 个人主页
  const current = path.startsWith("/text-lab") ? "textlab" : "home";

  // 点导航 → 改地址栏（而不再是改内存里的值）
  const onNavigate = (key) => navigate(key === "textlab" ? "/text-lab" : "/");

  return (
    <div className="app-shell">
      <div className="page-shell">
        <main className="page-content">
          {current === "home"
            ? <HomePage current={current} onNavigate={onNavigate} />
            : <TextLabPage current={current} onNavigate={onNavigate} />}
        </main>
      </div>
    </div>
  );
}
