// app/page.jsx → 网站根路径 "/"
// 这个文件坐在 app/ 目录里，Next.js 就知道："访问 / 的时候，渲染我"。
// 不用注册、不用配路由表、不用写 if/else——这就是"文件夹 = 路由"。
import HomeView from "../components/HomeView.jsx";

export default function Page() {
  return <HomeView />;
}
