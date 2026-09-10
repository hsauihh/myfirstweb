"use client";

// 全站 sticky 顶部导航栏：左 logo，中主导航（五项平铺），右「天气 + 主题 + 用户区」。
// ≤900px 折叠为汉堡菜单，导航与登录/用户操作都收进菜单，右侧只留 logo + 主题 + 汉堡。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navLinks } from "../data/site.js";
import NavUser from "./NavUser.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import WeatherWidget from "./WeatherWidget.jsx";

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // 路由变化时收起菜单（点链接、前进后退都覆盖）
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
          aria-controls="nav-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <ul id="nav-menu" className={"nav-menu" + (menuOpen ? " is-open" : "")}>
          {navLinks.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={"nav-link" + (isActive(item.href) ? " active" : "")}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="nav-user-mobile-item">
            <NavUser variant="mobile" onNavigate={() => setMenuOpen(false)} />
          </li>
        </ul>

        <div className="nav-actions">
          <WeatherWidget />
          <ThemeToggle />
          <NavUser variant="desktop" />
        </div>
      </nav>
    </header>
  );
}
