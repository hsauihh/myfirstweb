// 把架构图从 docs/ 发布到站点静态目录，供「关于」页链接（/architecture.html）。
// 单一真源是 docs/system-architecture.html；public/architecture.html 是构建产物（已 gitignore）。
// 由 package.json 的 predev / prebuild 自动调用。
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const SOURCE = "docs/system-architecture.html";
const TARGET = "public/architecture.html";

if (!existsSync(SOURCE)) {
  console.log(`[sync-architecture] 未找到 ${SOURCE}，跳过`);
  process.exit(0);
}

mkdirSync("public", { recursive: true });
copyFileSync(SOURCE, TARGET);
console.log(`[sync-architecture] ${SOURCE} → ${TARGET}`);
