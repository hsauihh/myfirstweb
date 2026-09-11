// app/blog/manage/page.jsx → 网站路径 "/blog/manage"（我的文章与编辑器）
// useSearchParams 需 Suspense 包裹。
import type { Metadata } from "next";
import { Suspense } from "react";
import BlogManageView from "../../../components/BlogManageView";

export const metadata: Metadata = {
  title: "我的文章 · zero to tech",
  description: "写作与管理自己的博客",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BlogManageView />
    </Suspense>
  );
}
