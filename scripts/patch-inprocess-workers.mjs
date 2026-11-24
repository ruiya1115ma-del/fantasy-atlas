#!/usr/bin/env node
/**
 * 本机沙箱禁止 fork 子进程，也不允许把渲染闭包 postMessage 给 worker 线程，
 * 所以 Next 的静态生成 worker（jest-worker）在这里必然失败：
 *   - ChildProcessWorker → spawn EPERM
 *   - NodeThreadWorker   → DataCloneError: ()=>null could not be cloned
 *
 * 这个脚本把 next/dist/lib/worker.js 的 Worker 类打一个补丁：
 * 设了 FA_INPROCESS_WORKERS=1 时，不再创建 jest-worker，
 * 而是直接 require 目标 worker 模块、在同一个进程里调用它的方法。
 *
 * 只影响本机构建，不会进仓库产物；`--restore` 可以还原。
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "node_modules/next/dist/lib/worker.js");
const backup = target + ".orig";
const marker = "/* FA_INPROCESS_WORKERS_PATCH */";

if (!fs.existsSync(target)) {
  console.error("找不到 next/dist/lib/worker.js，先在项目目录安装依赖");
  process.exit(1);
}

if (process.argv.includes("--restore")) {
  if (!fs.existsSync(backup)) {
    console.error("没有备份可以还原");
    process.exit(1);
  }
  fs.copyFileSync(backup, target);
  console.log("已还原 next/dist/lib/worker.js");
  process.exit(0);
}

// 每次都从原始文件出发，避免重复打补丁
if (fs.existsSync(backup)) {
  fs.copyFileSync(backup, target);
}

let source = fs.readFileSync(target, "utf8");

if (source.includes(marker)) {
  console.log("已经打过补丁，跳过");
  process.exit(0);
}

const needle = "this._worker = new _jestworker.Worker(workerPath, {";
const at = source.indexOf(needle);
if (at === -1) {
  console.error("结构变了：没找到 `new _jestworker.Worker(workerPath, {`");
  process.exit(1);
}

// 找到这行赋值语句的结尾 `});`
const endIdx = source.indexOf("});", at);
if (endIdx === -1) {
  console.error("结构变了：找不到 new Worker(...) 的结尾");
  process.exit(1);
}
const end = endIdx + 3;
const originalLine = source.slice(at, end);

const replacement = [
  marker,
  "      if (process.env.FA_INPROCESS_WORKERS === '1') {",
  "        // 在同一个进程里调用 worker 模块导出的方法，绕开 jest-worker。",
  "        const mod = require(workerPath);",
  "        const inProcess = {",
  "          getStdout: () => require('stream').Readable.from([]),",
  "          getStderr: () => require('stream').Readable.from([]),",
  "          end: async () => {}",
  "        };",
  "        this._worker = new Proxy(inProcess, {",
  "          get(t, prop) {",
  "            if (prop in t) return t[prop];",
  "            if (typeof prop !== 'string') return undefined;",
  "            return (...args) => Promise.resolve().then(() => {",
  "              if (typeof mod[prop] !== 'function') {",
  "                throw new Error('in-process worker 缺少方法: ' + prop);",
  "              }",
  "              return mod[prop](...args);",
  "            });",
  "          }",
  "        });",
  "        restartPromise = new Promise((resolve)=>resolveRestartPromise = resolve);",
  "      } else {",
  "        " + originalLine,
  "      }"
].join("\n");

source = source.slice(0, at) + replacement + source.slice(end);
fs.copyFileSync(target, backup);
fs.writeFileSync(target, source);
console.log("补丁完成：FA_INPROCESS_WORKERS=1 时静态生成改在同进程执行");
console.log("备份：" + path.relative(root, backup));
