// app/layout.jsx 是 Next.js 的"全站外壳"。
// Nav 在此全局渲染（每个页面自动出现 sticky 顶部导航栏：logo 返回入口 + 导航 + 天气 + 主题 + CTA）。
// 顶部 head 的内联脚本在首帧前设置 data-theme，避免主题闪烁。

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../css/fonts.css";
import "../css/reset.css";
import "../css/variables.css";
import "../css/layout.css";
import "../css/hero.css";
import "../css/nav.css";
import "../css/nav-user.css";
import "../css/cards.css";
import "../css/home.css";
import "../css/home-panels.css";
import "../css/home-notes.css";
import "../css/widgets.css";
import "../css/lab.css";
import "../css/chat.css";
import "../css/chat-ds.css";
import "../css/chat-ds-messages.css";
import "../css/markdown.css";
import "../css/blog.css";
import "../css/blog-manage.css";
import "../css/knowledge.css";
import "../css/auth.css";
import "../css/messages.css";
import "../css/messages-panels.css";
import "../css/chat-window.css";
import "../css/responsive.css";
import Nav from "../components/Nav";
import AddFriendModal from "../components/AddFriendModal";
import { AuthProvider } from "../components/AuthContext";
import { MessagesProvider } from "../components/MessagesContext";

export const metadata: Metadata = {
  title: "zero to tech",
  description: "个人主页 + 文字实验室",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})();",
          }}
        />
        {/* 霞鹜文楷（主字体）：用 <link> 并行加载，不要写成 CSS @import——
            远程 @import 会给本站样式表加一个第三方阻塞依赖（字体 CDN 被拦/变慢时会拖首屏）。
            只留这一个远程字体源：Noto Sans SC 只作为「文楷缺字」的兜底，
            改用系统字体栈（PingFang SC / Microsoft YaHei 等），省一个第三方阻塞请求。 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-bold.css"
        />
      </head>
      <body>
        <AuthProvider>
          <MessagesProvider>
            <Nav />
            <AddFriendModal />
            <div className="app-shell">
              <div className="page-shell container">
                <main className="page-content">{children}</main>
              </div>
            </div>
          </MessagesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
