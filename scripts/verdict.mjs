// 开放决策的判定逻辑（A-36、A-48）：只有 resolved 为 true，并且附上用户原话（user_quote）和日期（resolved_on），才算已拍板。
// 执行方不能自行填写 user_quote；用户拍板之后，由审计方或用户本人对照对话记录核验（A-51）。
export function isResolved(d) {
  return d.resolved === true && typeof d.user_quote === "string" && d.user_quote.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(d.resolved_on ?? "");
}

// 影响结论、但还没拍板的事项
export function pendingBlockers(items) {
  return items.filter((d) => d.blocks_verdict && !isResolved(d));
}
