import { useEffect, useState } from "react";

// 一个非常小的"路由"，干三件事：
//   - 读浏览器地址栏的 path，决定显示哪一页（一刷新还在这一页）
//   - 提供一个 navigate(path)，点导航时把"在哪一页"写进地址栏
//   - 用户按浏览器前进 / 后退，界面也跟着变
//
// 关键就在于：4.3 把"在哪一页"记在内存里（一刷新就丢）；
// 这一版把它换成"写在网址里"——网址刷新不丢、能整条复制、能前进后退。
//
// 这一版"够用但糙"：自己手写、要兼顾的边角不少。真实项目里大家不手搓，
// 而是用现成的库（叫 react-router）；再往后 Next.js 会用"文件夹=路由"把它整个替掉。
export function useRoute() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  function navigate(to) {
    if (to === path) return;
    window.history.pushState({}, "", to);
    setPath(to);
  }

  return { path, navigate };
}
