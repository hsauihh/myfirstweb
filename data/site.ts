// 网站要显示的"内容"，全都集中在这里。
// 想改标题、改文案、加作品？只动这个文件，组件代码一个字都不用碰。
// 这就是"数据与界面分离"：组件只管"怎么显示"，site.js 只管"显示什么"。
//
// 埋了一颗模块 5 的种子：现在这些值写死在文件里；等后端登场，
// 它们可以改成从网络接口实时取——而组件那边照样一个字都不用动。

export interface HomeContent {
  heroTitle: string;
  heroSubtitle: string;
  featuredWork: {
    kicker: string;
    title: string;
    copy: string;
    linkLabel: string;
  };
  identity: { motto: string; learning: string };
}

export const home: HomeContent = {
  heroTitle: "关于我",
  heroSubtitle: "项目，创意，灵感，心得，我的作品",
  featuredWork: {
    kicker: "作品",
    title: "文字实验室",
    copy: "拼音和情绪，挖掘中文里的细节",
    linkLabel: "打开作品",
  },
  identity: {
    motto: "已识乾坤大，尤怜草木青",
    learning: "零到全栈",
  },
};

export const textLab: { heroTitle: string; heroSubtitle: string } = {
  heroTitle: "文字实验室",
  heroSubtitle: "拼音和情绪，挖掘中文里的细节",
};

// AI 对话的常用提示词：点击填入输入框，用户再粘贴要处理的文字。
export interface PromptChip {
  label: string;
  prompt: string;
}

export const textLabPrompts: PromptChip[] = [
  { label: "润色书面化", prompt: "帮我把下面这段文字润色得更书面、通顺：\n" },
  { label: "起三个标题", prompt: "给下面这段文字起三个吸引人的标题：\n" },
  { label: "总结要点", prompt: "用三点总结下面这段文字的要点：\n" },
  { label: "翻成英文", prompt: "把下面这段文字翻译成地道的英文：\n" },
  { label: "分析情绪", prompt: "分析下面这段文字的情绪倾向，并说明理由：\n" },
  { label: "改得口语", prompt: "把下面这段文字改得更口语、自然：\n" },
];

// 顶部主导航：六项全部一级平铺，不放二级下拉。
export interface NavLink {
  href: string;
  label: string;
}

export const navLinks: NavLink[] = [
  { href: "/", label: "首页" },
  { href: "/text-lab", label: "文字实验室" },
  { href: "/blog", label: "博客" },
  { href: "/knowledge", label: "知识库" },
  { href: "/works", label: "作品" },
  { href: "/about", label: "关于" },
];

// 主页「作品」模块的轮播数据（前端本地列表，不动后端 /api/profile）。
// 每条是独立的一块卡片内容，最终跳转到该条的 href。
export interface FeaturedWork {
  kicker: string;
  title: string;
  copy: string;
  linkLabel: string;
  href: string;
}

export const featuredWorks: FeaturedWork[] = [
  {
    kicker: "作品",
    title: "文字实验室",
    copy: "拼音和情绪，挖掘中文里的细节",
    linkLabel: "打开作品",
    href: "/text-lab",
  },
  {
    kicker: "作品",
    title: "关于",
    copy: "关于我，关于这个站",
    linkLabel: "了解更多",
    href: "/about",
  },
  {
    kicker: "作品",
    title: "博客",
    copy: "零碎的想法，慢慢写",
    linkLabel: "去逛逛",
    href: "/blog",
  },
];
