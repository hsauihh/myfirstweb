// app/knowledge/page.jsx → 网站路径 "/knowledge"（我的知识库）
import "../../css/genshin-font.css";
import KnowledgeView from "../../components/KnowledgeView.jsx";

export const metadata = {
  title: "知识库 · zero to tech",
  description: "把博客文章选入个人知识库，供知识库问答使用",
};

export default function Page() {
  return <KnowledgeView />;
}
