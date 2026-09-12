// 网站要显示的"内容"，全都集中在这里。
// 想改标题、改文案、加作品？只动这个文件，组件代码一个字都不用碰。
// 这就是"数据与界面分离"：组件只管"怎么显示"，site.js 只管"显示什么"。
//
// 埋了一颗模块 5 的种子：现在这些值写死在文件里；等后端登场，
// 它们可以改成从网络接口实时取——而组件那边照样一个字都不用动。

// 首页只用得到标题、副标题与「正在学习」；接口多返回的字段不在前端类型里声明
// （与 types.ts 的约定一致）。
export interface HomeContent {
  heroTitle: string;
  heroSubtitle: string;
  identity: { learning: string };
}

export const home: HomeContent = {
  heroTitle: "关于我",
  heroSubtitle: "项目，创意，灵感，心得，我的作品",
  identity: {
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
