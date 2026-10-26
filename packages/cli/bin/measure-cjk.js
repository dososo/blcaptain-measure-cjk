#!/usr/bin/env node
import { main } from "../dist/cli.js";

// 完整档（--render）是异步的，main 返回 Promise；其余命令同步返回退出码
const code = main(process.argv.slice(2));
if (typeof code === "number") process.exitCode = code;
else code.then((c) => (process.exitCode = c));
