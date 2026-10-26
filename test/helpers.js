// 测试辅助：捕获 main() 写到 stdout / stderr 的内容
export function capture(fn) {
  const out = [];
  const err = [];
  const ow = process.stdout.write.bind(process.stdout);
  const ew = process.stderr.write.bind(process.stderr);
  process.stdout.write = (s) => (out.push(String(s)), true);
  process.stderr.write = (s) => (err.push(String(s)), true);
  try {
    const code = fn();
    return { code, stdout: out.join(""), stderr: err.join("") };
  } finally {
    process.stdout.write = ow;
    process.stderr.write = ew;
  }
}
