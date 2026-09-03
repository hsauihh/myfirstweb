// app/layout.jsx 是 Next.js 的"全站外壳"——所有页面都套在它里面。
// 它取代了 4.4 的 index.html + main.jsx + App.jsx 最外面那层壳：
//   - <html>/<body> 由它提供；
//   - app-shell / page-shell / page-content 这层包裹，和 4.4 App.jsx 里一模一样；
//   - 4.4 main.jsx 里那 8 行 import CSS，原样搬到这里（顺序不变）。
// 注意：导航条 Nav 不在这儿，它在每一页的 hero 里（HomeView / TextLabView 各放一份），
// 这样整页布局和 4.4 完全一致。

import "../css/reset.css";
import "../css/variables.css";
import "../css/layout.css";
import "../css/hero.css";
import "../css/nav.css";
import "../css/cards.css";
import "../css/lab.css";
import "../css/responsive.css";

export const metadata = {
  title: "zero to tech",
  description: "个人主页 + 文字实验室",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
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
