// app/layout.jsx 是 Next.js 的"全站外壳"——所有页面都套在它里面。
// 顶部 head 里的内联脚本在首帧渲染前设置 data-theme（浅色/暗色），避免主题闪烁。

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
        <div className="app-shell">
          <div className="page-shell">
            <main className="page-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
