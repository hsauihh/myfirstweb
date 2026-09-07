// app/layout.jsx 是 Next.js 的"全站外壳"。
// Nav 在此全局渲染（每个页面自动出现 sticky 顶部导航栏：logo 返回入口 + 导航 + 天气 + 主题 + CTA）。
// 顶部 head 的内联脚本在首帧前设置 data-theme，避免主题闪烁。

import "../css/fonts.css";
import "../css/reset.css";
import "../css/variables.css";
import "../css/layout.css";
import "../css/hero.css";
import "../css/nav.css";
import "../css/cards.css";
import "../css/widgets.css";
import "../css/lab.css";
import "../css/responsive.css";
import Nav from "../components/Nav.jsx";

export const metadata = {
  title: "zero to tech",
  description: "个人主页 + 文字实验室",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})();",
          }}
        />
      </head>
      <body>
        <Nav />
        <div className="app-shell">
          <div className="page-shell container">
            <main className="page-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
