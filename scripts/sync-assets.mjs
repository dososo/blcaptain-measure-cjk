// 把仓库级的数据和样式同步进 CLI 包（npm 发布时包内要自带）。测试会校验两份内容一致。
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pairs = [
  ["data/fonts/licenses.json", "packages/cli/data/licenses.json"],
  ["skills/measure/assets/measure.css", "packages/cli/assets/measure.css"],
  // npm 包里要带上授权文件：代码 Apache-2.0，授权表和文档 CC BY 4.0
  ["LICENSE", "packages/cli/LICENSE"],
  ["LICENSE-docs", "packages/cli/LICENSE-docs"],
  ["NOTICE", "packages/cli/NOTICE"]
];
for (const [from, to] of pairs) {
  mkdirSync(dirname(join(root, to)), { recursive: true });
  copyFileSync(join(root, from), join(root, to));
}
console.log(`已同步 ${pairs.length} 个文件到 packages/cli`);
