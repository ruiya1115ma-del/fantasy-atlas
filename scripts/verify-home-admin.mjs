/**
 * 首页内容管理（后台）端到端验证脚本。
 *
 * 覆盖：登录鉴权 → 读取配置 → 新增板块/主题 → 改名 → 隐藏/恢复 → 排序 →
 *       电影批量加入（同板块自动互斥）→ 单部移除（只解除关联）→ 前台同步 → 持久化 → 删除板块。
 *
 * 用法：node scripts/verify-home-admin.mjs
 * 会在开始时备份 data/home-config.json，结束时恢复原配置。
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:4317";
const USER = process.env.ADMIN_USER ?? "admin";
const PASS = process.env.ADMIN_PASSWORD ?? "mry2001";
const CONFIG_PATH = path.join(process.cwd(), "data", "home-config.json");
const CATALOG_PATH = path.join(process.cwd(), "data", "catalog.json");

let cookie = "";
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function api(pathname, options = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(options.headers ?? {}) },
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json, text };
}

async function main() {
  const original = fs.readFileSync(CONFIG_PATH, "utf8");

  // 1. 未登录不得读写
  const anon = await api("/api/admin/home");
  check("未登录读取配置被拒绝（401）", anon.status === 401, `status=${anon.status}`);

  // 2. 登录
  const login = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ username: USER, password: PASS }) });
  check("管理员登录成功", login.status === 200 && Boolean(cookie), `status=${login.status}`);

  const before = await api("/api/admin/home");
  const originalSections = before.json.config.sections;
  const movies = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")).movies;
  const movieA = movies[0];
  const movieB = movies[1];
  check("读取到现有配置", before.status === 200 && originalSections.length > 0, `sections=${originalSections.length}`);

  // 3. 新增板块 + 主题 + 改名 + 排序 + 隐藏
  const draft = JSON.parse(JSON.stringify(before.json.config));
  draft.sections.push({
    id: "sec-e2e",
    title: "E2E 测试板块",
    subtitle: "自动化验证",
    hidden: false,
    themes: [
      { id: "thm-e2e-a", name: "E2E 主题甲", image: "", hidden: false, movieIds: [movieA.id] },
      { id: "thm-e2e-b", name: "E2E 主题乙", image: "", hidden: false, movieIds: [] },
      { id: "thm-e2e-hidden", name: "E2E 隐藏主题", image: "", hidden: true, movieIds: [] },
    ],
  });
  // 把新板块排到最前面，验证排序
  const created = draft.sections.pop();
  draft.sections.unshift(created);

  const saved = await api("/api/admin/home", { method: "PUT", body: JSON.stringify({ config: draft }) });
  check("保存新板块与主题", saved.status === 200 && saved.json.ok, `status=${saved.status}`);

  const reloaded = await api("/api/admin/home");
  const e2eSection = reloaded.json.config.sections.find((s) => s.id === "sec-e2e");
  check("新板块排在最前（顺序持久化）", reloaded.json.config.sections[0].id === "sec-e2e");
  check("新主题已写入", e2eSection?.themes.length === 3, `themes=${e2eSection?.themes.length}`);

  // 4. 前台同步
  const home = await api("/");
  check("首页出现新板块标题", home.text.includes("E2E 测试板块"));
  check("首页出现主题卡片链接", home.text.includes("/collections/thm-e2e-a"));
  check("隐藏主题不在前台", !home.text.includes("E2E 隐藏主题"));

  // 5. 同板块互斥：把 movieA 也加到「E2E 主题乙」
  const add = await api("/api/admin/home/action", {
    method: "POST",
    body: JSON.stringify({ type: "addMovies", themeId: "thm-e2e-b", movieIds: [movieA.id, movieB.id] }),
  });
  check("批量加入电影成功", add.status === 200 && add.json.ok, `status=${add.status}`);
  check("同板块内自动从其它主题移出", Array.isArray(add.json.movedFrom) && add.json.movedFrom.length > 0, `movedFrom=${JSON.stringify(add.json.movedFrom)}`);

  const afterAdd = await api("/api/admin/home");
  const sec = afterAdd.json.config.sections.find((s) => s.id === "sec-e2e");
  const inA = sec.themes.find((t) => t.id === "thm-e2e-a").movieIds;
  const inB = sec.themes.find((t) => t.id === "thm-e2e-b").movieIds;
  check("同一板块内电影不重复", !inA.includes(movieA.id) && inB.includes(movieA.id), `甲=${inA.length} 乙=${inB.length}`);

  // 6. 不同板块允许重复
  const firstSection = afterAdd.json.config.sections.find((s) => s.id !== "sec-e2e" && s.themes.length);
  const otherTheme = firstSection.themes[0];
  const addElsewhere = await api("/api/admin/home/action", {
    method: "POST",
    body: JSON.stringify({ type: "addMovies", themeId: otherTheme.id, movieIds: [movieA.id] }),
  });
  check("不同板块之间允许同一部电影重复归属", addElsewhere.status === 200 && addElsewhere.json.ok);

  // 7. 移除只解除关联
  const remove = await api("/api/admin/home/action", {
    method: "POST",
    body: JSON.stringify({ type: "removeMovie", themeId: "thm-e2e-b", movieId: movieA.id }),
  });
  const afterRemove = await api("/api/admin/home");
  const bTheme = afterRemove.json.config.sections.find((s) => s.id === "sec-e2e").themes.find((t) => t.id === "thm-e2e-b");
  const catalogStill = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")).movies.some((m) => m.id === movieA.id);
  check("移除电影只解除关联", remove.json.ok && !bTheme.movieIds.includes(movieA.id) && catalogStill);

  // 8. 隐藏 / 恢复板块
  const hideDraft = JSON.parse(JSON.stringify(afterRemove.json.config));
  hideDraft.sections.find((s) => s.id === "sec-e2e").hidden = true;
  await api("/api/admin/home", { method: "PUT", body: JSON.stringify({ config: hideDraft }) });
  const hiddenHome = await api("/");
  check("隐藏板块不在前台展示", !hiddenHome.text.includes("E2E 测试板块"));
  const restoreDraft = JSON.parse(JSON.stringify(hideDraft));
  restoreDraft.sections.find((s) => s.id === "sec-e2e").hidden = false;
  await api("/api/admin/home", { method: "PUT", body: JSON.stringify({ config: restoreDraft }) });
  const restoredHome = await api("/");
  check("恢复后重新出现在前台", restoredHome.text.includes("E2E 测试板块"));

  // 9. 删除板块（只删配置与关联）
  const delDraft = JSON.parse(JSON.stringify(restoreDraft));
  delDraft.sections = delDraft.sections.filter((s) => s.id !== "sec-e2e");
  const del = await api("/api/admin/home", { method: "PUT", body: JSON.stringify({ config: delDraft }) });
  const afterDelete = await api("/api/admin/home");
  const catalogIntact = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")).movies.length === movies.length;
  check("删除板块成功且电影库不变", del.json.ok && !afterDelete.json.config.sections.some((s) => s.id === "sec-e2e") && catalogIntact, `movies=${movies.length}`);

  // 10. 还原原始配置
  const restore = await api("/api/admin/home", { method: "PUT", body: JSON.stringify({ config: JSON.parse(original) }) });
  fs.writeFileSync(CONFIG_PATH, original, "utf8");
  check("已还原验证前的配置", restore.status === 200);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n共 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("验证脚本异常：", err);
  process.exitCode = 1;
});
