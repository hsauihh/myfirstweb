// 占位页视图：居中 hero（eyebrow + 标题 + 副标题）+「内容建设中」卡片。
// 纯展示、无交互，服务端组件；内部用到的 Nav / AnimatedCardGrid 是客户端组件。
import PageHeading from "./PageHeading";
import AnimatedCardGrid from "./AnimatedCardGrid";

interface PlaceholderViewProps {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export default function PlaceholderView({ eyebrow, title, subtitle }: PlaceholderViewProps) {
  return (
    <AnimatedCardGrid className="dashboard-grid">
      <div className="panel-full">
        <PageHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </div>

      <article className="panel panel-full card placeholder-panel">
        <p className="section-kicker">页面建设中</p>
        <p className="section-subtitle">这里的内容正在准备中，敬请期待。</p>
      </article>
    </AnimatedCardGrid>
  );
}
