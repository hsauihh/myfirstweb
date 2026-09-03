# zero-to-tech-5-5 · 前端替换文件（模块 5.5 配套代码）

这一节前端要改的都在 `components/` 和 `css/` 下，这里只放**改动的文件**，方便你直接覆盖，不用一行行敲。其余文件（`app/`、`data/site.js`、其它 css、后端）都不用动。

> 这不是一个能独立跑的工程，是"替换用的文件"。后端是你在模块 5 里一路搭起来的那个，跟着这一节课件给它加上 CORS 即可。

## 改了哪些文件

```
components/
  HomeView.jsx      ← 变客户端组件；useEffect 去 GET /api/profile，setData 更新界面
  TextLabView.jsx   ← 变客户端组件；把 result 状态提升到这里，下发给两张卡
  InputCard.jsx     ← 点"开始分析"→ POST /api/analyze，结果经 onResult 交给父组件
  ResultCard.jsx    ← 改成显示父组件传来的 result（无结果时用默认占位）
css/
  lab.css           ← 新增 .lab-error 样式（请求失败时的红色提示）
```

`HomeView` / `InputCard` 里都用 `try/catch` 接住了请求失败：主页失败就保持 `site.js` 打底并打到控制台，输入卡失败就在按钮上方给一行提示——界面不会无声崩掉。（这一节不展开讲这部分语法，代码给你备着。）

## 怎么用

课件到"前端直接替换"这一步时，用这些文件覆盖你 `~/zero-to-tech/` 下的同名文件即可。

```bash
git clone https://github.com/joylibo/zero-to-tech-demos.git
cp zero-to-tech-demos/zero-to-tech-5-5/components/*.jsx ~/zero-to-tech/components/
cp zero-to-tech-demos/zero-to-tech-5-5/css/lab.css      ~/zero-to-tech/css/
```

## 两点说明

- 后端地址暂时**写死**成 `http://localhost:8000`。跟着课件，这一节最后会把它收进 `.env.local`。
- 要看到"来自后端"的数据，得让你模块 5 的后端跑在 8000 端口、并按课件配好 CORS；后端没跑或跨源被拦时，主页会**回退**显示 `data/site.js` 的打底数据，文字实验室点"开始分析"会给一行错误提示。
