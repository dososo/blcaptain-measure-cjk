#!/bin/sh
# AUDIT_CARD CA-12、AUDIT_CARD_r2 CB-03：在高负载下（与真实字体卡片导出并行）重复跑全量测试，保留完整输出。
# 用法：sh scripts/stress-card.sh <次数> <日志目录>
# 需要 ../deliverables/fonts-for-test/LXGWWenKai-Regular.ttf（D-C6）。每次的完整输出写进 <日志目录>/stress-<i>.log，
# 汇总（含 uptime 负载、失败项、「完整档单页超时」的耗时）写进 <日志目录>/stress-summary.log。不自动重试。
set -u
N=${1:-3}
OUT=${2:?需要日志目录}
cd "$(dirname "$0")/.."
mkdir -p "$OUT"
STOP="$OUT/.stop"
rm -f "$STOP"
SUM="$OUT/stress-summary.log"
echo "# HEAD $(git rev-parse --short HEAD)；开始 $(date -u +%FT%TZ)；$(uptime)" > "$SUM"
( while [ ! -f "$STOP" ]; do for c in cover list quote; do node packages/cli/bin/measure-cjk.js card "skills/measure/assets/cards/$c.html" --out "../deliverables/stress-$c.png" --font-dir ../deliverables/fonts-for-test --root .. >/dev/null 2>&1; done; done ) &
LOAD=$!
i=1
while [ "$i" -le "$N" ]; do
  echo "## 第 $i 次：开始时 $(uptime)" >> "$SUM"
  npm test > "$OUT/stress-$i.log" 2>&1
  echo "退出码 $?；结束时 $(uptime)" >> "$SUM"
  grep -E "^ℹ (tests|pass|fail|duration_ms)|^✖|完整档单页超时" "$OUT/stress-$i.log" | grep -v "failing tests" >> "$SUM"
  i=$((i + 1))
done
touch "$STOP"
wait "$LOAD"
rm -f "$STOP" ../deliverables/stress-*.png
echo "# 结束 $(date -u +%FT%TZ)" >> "$SUM"
cat "$SUM"
