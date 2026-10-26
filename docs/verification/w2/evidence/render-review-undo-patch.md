# R-01、R-02「修复前」证据的复现方法（回应 AUDIT_RENDER §3 第 2 条）

`render-review-tests-before-fix.log` 是在 commit `da754c1` 的构建产物上，临时撤掉两处修复后跑出来的。撤掉修复用的命令如下（在仓库根目录执行，只改 `dist`，不改源码）：

```bash
npm run build
D=packages/cli/dist
# 撤掉 R-02 的修复：DNS 拦截规则不再排除 *.localhost、127.0.0.1、[::1]（只保留 EXCLUDE localhost）
sed -i '' 's/ , EXCLUDE \*\.localhost , EXCLUDE 127\.0\.0\.1 , EXCLUDE \[::1\]//' $D/render.js
# 撤掉 R-01 的修复：渲染失败时不再把整体结果记为 incomplete
sed -i '' 's/ctx\.acc\.incomplete = true;//g' $D/render.js
node --test --test-reporter=spec test/w2-render-review.test.js   # 结果见 render-review-tests-before-fix.log：2 条都失败
npm run build                                                     # 恢复构建产物
node --test --test-reporter=spec test/w2-render-review.test.js   # 结果见 render-review-tests-after-fix.log：2 条都通过
```

说明：
- 这两条 `sed` 是针对 `da754c1` 的产物写的。之后 `render.ts` 改过（AUDIT_RENDER 整改），在当前代码上要复现，需要按当时的代码行重写。
- 第二条 `sed` 会删掉文件里所有 `ctx.acc.incomplete = true;`，也包括超时那一处。这两个回归测试都不涉及超时，所以结论不受影响。

同样的做法也用在了 RA-19 的对照上：在当前构建产物里，临时把本地文件模式的浏览器参数改回旧值（放行 localhost），测试测到 4 个 TCP 连接，确实能抓住问题。见 `RA-19-old-args.log`。
