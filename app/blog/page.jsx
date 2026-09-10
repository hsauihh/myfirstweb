// app/blog/page.jsx → 网站路径 "/blog"（公开文章列表）
import BlogView from "../../components/BlogView.jsx";

export const metadata = {
  title: "博客 · zero to tech",
  description: "零碎的想法，慢慢写，慢慢积累",
};

export default function Page() {
  return <BlogView />;
}
