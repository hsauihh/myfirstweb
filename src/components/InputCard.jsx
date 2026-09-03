import { useState } from "react";

// 文字实验室的"输入区"卡片。
// 这一节它多了一个"会变的值"：text——这就是 state。
//   · text 是这个组件自己揣着的值，出生时带着一段默认文字；
//   · 用户每打一个字、删一个字，text 就变；
//   · text 一变，下面那行"已输入 N 字"当场跟着跳——
//     你连一句"找到那个元素再去改它"都不用写，React 自己刷。
export default function InputCard() {
  const [text, setText] = useState("今天的风很轻，适合把脑海里的想法慢慢写下来。");

  return (
    <article className="panel panel-half lab-panel card">
      <div className="panel-heading">
        <p className="section-kicker">输入区</p>
        <h3>贴一段中文</h3>
      </div>
      <form className="lab-form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="text-input">文本内容</label>
        <textarea
          id="text-input"
          rows="8"
          placeholder="例如：生活没有标准答案，但每一天都值得认真感受。"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {/* state 现身：text 一变，这行数字自动跟着变 */}
        <p className="lab-count">已输入 {text.length} 字</p>
        {/* "开始分析"要真出结果，得等模块 5 接后端，这里先按兵不动 */}
        <button className="primary-button" type="button">开始分析</button>
      </form>
    </article>
  );
}
