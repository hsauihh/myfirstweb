"use client";

// 顶部这一条（品牌 + 导航）。用 Next.js 的 <Link> 跳页面、usePathname() 高亮当前页。
// 因为要用 usePathname、useState（下拉）、DOM 事件，所以标了 "use client"。
// trailing：可选右侧附加内容（如主页的天气小部件），渲染在导航链接之后、最右端。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { moreLinks } from "../data/site.js";
import ThemeToggle from "./ThemeToggle.jsx";
import WeatherWidget from "./WeatherWidget.jsx";

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const items = [
    { href: "/", label: "个人主页" },
    { href: "/text-lab", label: "文字实验室" },
  ];

  // 点击外部 / 按 Escape 关闭下拉菜单
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <div className="hero-topline">
      <div className="hero-topline-end">
        <nav className="inline-links hero-nav" aria-label="主导航">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={"nav-link" + (isActive(it.href) ? " active" : "")}
            >
              {it.label}
            </Link>
          ))}

          <div className="more-menu" ref={menuRef}>
            <button
              type="button"
              className={"nav-link more-trigger" + (open ? " is-open" : "")}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              更多
              <svg
                className="more-chevron"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {open && (
              <div className="more-panel" role="menu" aria-label="更多页面">
                {moreLinks.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    role="menuitem"
                    className={"more-link" + (isActive(it.href) ? " active" : "")}
                    onClick={() => setOpen(false)}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>
        <ThemeToggle />
        <WeatherWidget />
      </div>
    </div>
  );
}
