"use client";

// 全站 sticky 顶部导航栏：左 logo，右「天气 + 主题切换 + CTA 按钮」。
// 中为导航链接（首页 / 文字实验室 / 更多下拉），移动端折叠为汉堡菜单。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { moreLinks } from "../data/site.js";
import NavAuth from "./NavAuth.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import WeatherWidget from "./WeatherWidget.jsx";
import { useMessages } from "./MessagesContext.jsx";

export default function Nav() {
  const pathname = usePathname();
  const { reminderEnabled, totalUnread } = useMessages();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  const items = [
    { href: "/", label: "首页" },
    { href: "/text-lab", label: "文字实验室" },
  ];

  // 点击外部 / 按 Escape 关闭「更多」下拉
  useEffect(() => {
    if (!moreOpen) return;
    function onDocClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="site-header">
      <nav className="navbar container">
        <Link href="/" className="navbar-brand">
          zero to full
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-label="切换菜单"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <ul className={"nav-menu" + (menuOpen ? " is-open" : "")}>
          {items.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                className={"nav-link" + (isActive(it.href) ? " active" : "")}
                onClick={() => setMenuOpen(false)}
              >
                {it.label}
              </Link>
            </li>
          ))}

          <li className="nav-more" ref={moreRef}>
            <button
              type="button"
              className={"nav-link" + (moreOpen ? " active" : "")}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((o) => !o)}
            >
              更多
            </button>

            {moreOpen && (
              <div className="more-panel" role="menu" aria-label="更多页面">
                {moreLinks.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    role="menuitem"
                    className={"more-link" + (isActive(it.href) ? " active" : "")}
                    onClick={() => {
                      setMoreOpen(false);
                      setMenuOpen(false);
                    }}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            )}
          </li>
        </ul>

        <div className="nav-actions">
          <WeatherWidget />
          <ThemeToggle />
          <NavAuth>
            <Link
              href="/messages"
              className={"nav-link" + (isActive("/messages") ? " active" : "")}
            >
              消息
              {reminderEnabled && totalUnread > 0 && (
                <span className="nav-badge">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Link>
          </NavAuth>
          <Link href="/text-lab" className="btn btn-primary">
            开始使用
          </Link>
        </div>
      </nav>
    </header>
  );
}
