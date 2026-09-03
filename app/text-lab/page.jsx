// app/text-lab/page.jsx → 网站路径 "/text-lab"
// 想加一个 /blog 页面？不用改任何"路由配置"——在 app/ 下新建一个
// blog/page.jsx 就行。"文件夹结构 = 网站结构"。
import TextLabView from "../../components/TextLabView.jsx";

export default function Page() {
  return <TextLabView />;
}
