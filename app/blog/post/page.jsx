// app/blog/post/page.jsx → 网站路径 "/blog/post?id=123"（文章详情）
// 静态导出不能有动态路由，详情用 query 参数承载；useSearchParams 需 Suspense 包裹。
import { Suspense } from "react";
import BlogPostView from "../../../components/BlogPostView";

export const metadata = {
  title: "文章 · zero to tech",
  description: "阅读博客文章",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BlogPostView />
    </Suspense>
  );
}
