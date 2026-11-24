"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HomeConfig, HomeSection, HomeTheme } from "@/lib/home-config";

interface MovieHit {
  id: string;
  title: string;
  originalTitle: string;
  year: number;
  poster: string;
}

interface Props {
  initialConfig: HomeConfig;
  libraryCount: number;
  library: MovieHit[];
}

const btn =
  "border border-[var(--hairline)] px-2.5 py-1 text-[0.7rem] tracking-[0.04em] text-[var(--color-ivory-dim)] transition-colors hover:border-[rgba(226,200,127,0.65)] hover:text-gold-soft disabled:opacity-40";
const btnPrimary =
  "border border-[rgba(226,200,127,0.6)] bg-[rgba(226,200,127,0.12)] px-3 py-1.5 text-[0.72rem] text-gold-soft transition-colors hover:bg-[rgba(226,200,127,0.2)] disabled:opacity-40";
const input =
  "w-full border border-[var(--hairline)] bg-[rgba(8,10,16,0.6)] px-2.5 py-1.5 text-[0.8rem] text-ivory outline-none focus:border-[rgba(226,200,127,0.6)]";

function clone(config: HomeConfig): HomeConfig {
  return JSON.parse(JSON.stringify(config)) as HomeConfig;
}

export function AdminHomeManager({ initialConfig, libraryCount, library }: Props) {
  const [config, setConfig] = useState<HomeConfig>(initialConfig);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [openThemeId, setOpenThemeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [picks, setPicks] = useState<Record<string, boolean>>({});

  const movieById = useMemo(() => new Map(library.map((m) => [m.id, m])), [library]);

  // 从后台总览的「电影管理」入口进来时（/admin/home#movies），自动展开第一个主题的电影面板
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#movies") return;
    const first = initialConfig.sections.flatMap((s) => s.themes)[0];
    if (first) setOpenThemeId(first.id);
  }, [initialConfig]);

  const saveStructure = useCallback(
    async (next: HomeConfig, note = "已保存") => {
      setBusy(true);
      setMessage("保存中…");
      try {
        const res = await fetch("/api/admin/home", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: next }),
        });
        const data = (await res.json()) as { ok: boolean; config?: HomeConfig; error?: string; duplicates?: number; droppedMovies?: number };
        if (!res.ok || !data.ok || !data.config) throw new Error(data.error ?? "保存失败");
        setConfig(data.config);
        setMessage(
          `${note}（${new Date().toLocaleTimeString("zh-CN")}）` +
            (data.duplicates ? ` · 同板块重复已去重 ${data.duplicates} 条` : "") +
            (data.droppedMovies ? ` · 忽略无效电影 ${data.droppedMovies} 条` : "")
        );
      } catch (err) {
        setMessage(`保存失败：${err instanceof Error ? err.message : "未知错误"}`);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const mutate = (fn: (draft: HomeConfig) => void, note?: string) => {
    const draft = clone(config);
    fn(draft);
    setConfig(draft);
    void saveStructure(draft, note);
  };

  /* ---------- 板块 ---------- */
  const addSection = () =>
    mutate((d) => {
      d.sections.push({ id: `sec-${Date.now().toString(36)}`, title: `新板块 ${d.sections.length + 1}`, subtitle: "", layout: "grid", hidden: false, themes: [] });
    }, "已新增板块");

  const moveSection = (index: number, dir: -1 | 1) =>
    mutate((d) => {
      const target = index + dir;
      if (target < 0 || target >= d.sections.length) return;
      const [item] = d.sections.splice(index, 1);
      d.sections.splice(target, 0, item);
    }, "已调整板块顺序");

  const deleteSection = (section: HomeSection) => {
    const themeCount = section.themes.length;
    const movieLinks = section.themes.reduce((acc, t) => acc + t.movieIds.length, 0);
    const ok = window.confirm(
      `确定删除板块「${section.title}」？\n\n影响范围：\n· 该板块下的 ${themeCount} 个主题配置会被一并删除\n· ${movieLinks} 条「主题—电影」关联会被清除\n· 电影原始资料不受影响（${libraryCount} 部仍在库中）\n\n此操作不可撤销，但可在 data/backups 里找到保存前的配置备份。`
    );
    if (!ok) return;
    mutate((d) => {
      d.sections = d.sections.filter((s) => s.id !== section.id);
    }, "已删除板块");
  };

  /* ---------- 主题 ---------- */
  const addTheme = (sectionId: string) =>
    mutate((d) => {
      const section = d.sections.find((s) => s.id === sectionId);
      if (!section) return;
      section.themes.push({
        id: `thm-${Date.now().toString(36)}`,
        name: `新主题 ${section.themes.length + 1}`,
        image: "",
        hidden: false,
        movieIds: [],
      });
    }, "已新增主题");

  const moveTheme = (sectionId: string, index: number, dir: -1 | 1) =>
    mutate((d) => {
      const section = d.sections.find((s) => s.id === sectionId);
      if (!section) return;
      const target = index + dir;
      if (target < 0 || target >= section.themes.length) return;
      const [item] = section.themes.splice(index, 1);
      section.themes.splice(target, 0, item);
    }, "已调整主题顺序");

  const deleteTheme = (theme: HomeTheme) => {
    const ok = window.confirm(
      `确定删除主题「${theme.name}」？\n\n影响范围：\n· 该主题配置与 ${theme.movieIds.length} 条电影关联会被删除\n· 电影原始资料不受影响\n\n此操作不可撤销。`
    );
    if (!ok) return;
    mutate((d) => {
      for (const s of d.sections) s.themes = s.themes.filter((t) => t.id !== theme.id);
      if (openThemeId === theme.id) setOpenThemeId(null);
    }, "已删除主题");
  };

  const moveThemeToSection = (themeId: string, toSectionId: string) =>
    mutate((d) => {
      let moving: HomeTheme | undefined;
      for (const s of d.sections) {
        const idx = s.themes.findIndex((t) => t.id === themeId);
        if (idx >= 0) {
          moving = s.themes[idx];
          s.themes.splice(idx, 1);
          break;
        }
      }
      const target = d.sections.find((s) => s.id === toSectionId);
      if (moving && target) target.themes.push(moving);
    }, "已移动主题");

  /* ---------- 电影归属 ---------- */
  const action = async (payload: Record<string, unknown>, note: string) => {
    setBusy(true);
    setMessage("保存中…");
    try {
      const res = await fetch("/api/admin/home/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; config?: HomeConfig; error?: string; movedFrom?: string[] };
      if (!res.ok || !data.ok || !data.config) throw new Error(data.error ?? "保存失败");
      setConfig(data.config);
      const moved = data.movedFrom?.length ? ` · 同板块内已从「${data.movedFrom.join("、")}」移出` : "";
      setMessage(`${note}${moved}（${new Date().toLocaleTimeString("zh-CN")}）`);
    } catch (err) {
      setMessage(`保存失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setBusy(false);
    }
  };

  const addPicked = async (theme: HomeTheme) => {
    const ids = Object.entries(picks).filter(([, v]) => v).map(([k]) => k);
    if (!ids.length) {
      setMessage("先在右侧搜索结果里勾选要加入的电影");
      return;
    }
    await action({ type: "addMovies", themeId: theme.id, movieIds: ids }, `已加入 ${ids.length} 部`);
    setPicks({});
  };

  const openTheme = useMemo(() => {
    if (!openThemeId) return null;
    for (const s of config.sections) {
      const t = s.themes.find((x) => x.id === openThemeId);
      if (t) return { section: s, theme: t };
    }
    return null;
  }, [config, openThemeId]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return library
      .filter((m) => [m.title, m.originalTitle, String(m.year)].join(" ").toLowerCase().includes(q))
      .slice(0, 24);
  }, [library, search]);

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Admin · Home</p>
          <h1 className="display mt-3 text-3xl text-ivory">首页内容管理</h1>
          <p className="lede mt-3 max-w-2xl text-[0.88rem]">
            首页有多少板块、每个板块几个主题、主题叫什么、用哪张图、收录哪些电影，全部在这里决定。
            保存后首页立即生效；电影库总计 {libraryCount} 部，删除主题只解除关联，不会删电影。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[0.72rem] text-[var(--color-ash-dim)]">{busy ? "处理中…" : message}</span>
          <button className={btnPrimary} onClick={addSection} disabled={busy}>
            + 新增板块
          </button>
        </div>
      </div>

      <div className="mt-8 space-y-6" id="sections">
        {config.sections.map((section, si) => (
          <section
            key={section.id}
            className={`border p-4 sm:p-5 ${section.hidden ? "border-dashed border-[rgba(120,120,140,0.4)] opacity-70" : "border-[var(--hairline)]"}`}
            style={{ background: "rgba(9,11,18,0.55)" }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[0.66rem] uppercase tracking-[0.2em] text-[var(--color-ash-dim)]">板块 {si + 1}</span>
              <input
                className={`${input} max-w-[300px]`}
                value={section.title}
                onChange={(e) => {
                  const v = e.target.value;
                  setConfig((c) => ({ ...c, sections: c.sections.map((s) => (s.id === section.id ? { ...s, title: v } : s)) }));
                }}
                onBlur={() => void saveStructure(config, "已修改板块名称")}
                aria-label="板块名称"
              />
              <input
                className={`${input} max-w-[320px]`}
                placeholder="板块副标题（可选）"
                value={section.subtitle ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setConfig((c) => ({ ...c, sections: c.sections.map((s) => (s.id === section.id ? { ...s, subtitle: v } : s)) }));
                }}
                onBlur={() => void saveStructure(config, "已修改板块副标题")}
                aria-label="板块副标题"
              />
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <span className="text-[0.7rem] text-[var(--color-ash-dim)]">{section.themes.length} 个主题</span>
                <label className="flex items-center gap-1.5 text-[0.68rem] text-[var(--color-ash-dim)]">
                  前台布局
                  <select
                    className="border border-[var(--hairline)] bg-[rgba(8,10,16,0.8)] px-1.5 py-1 text-[0.68rem] text-ivory"
                    value={section.layout}
                    onChange={(e) => mutate((d) => {
                      const s = d.sections.find((x) => x.id === section.id);
                      if (s) s.layout = e.target.value === "expand" ? "expand" : "grid";
                    }, "已修改板块布局")}
                    aria-label="板块前台布局"
                  >
                    <option value="expand">并排悬停展开</option>
                    <option value="grid">平铺网格</option>
                  </select>
                </label>
                <button className={btn} onClick={() => moveSection(si, -1)} disabled={busy || si === 0}>
                  ↑
                </button>
                <button className={btn} onClick={() => moveSection(si, 1)} disabled={busy || si === config.sections.length - 1}>
                  ↓
                </button>
                <button className={btn} onClick={() => mutate((d) => { const s = d.sections.find((x) => x.id === section.id); if (s) s.hidden = !s.hidden; }, section.hidden ? "已恢复板块" : "已隐藏板块")} disabled={busy}>
                  {section.hidden ? "恢复" : "隐藏"}
                </button>
                <button className={btn} onClick={() => deleteSection(section)} disabled={busy}>
                  删除板块
                </button>
                <button className={btnPrimary} onClick={() => addTheme(section.id)} disabled={busy}>
                  + 新增主题
                </button>
              </div>
            </div>

            {section.themes.length === 0 ? (
              <p className="mt-4 text-[0.8rem] text-[var(--color-ash-dim)]">这个板块还没有主题，点「新增主题」开始。</p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" id={`themes-${section.id}`}>
                {section.themes.map((theme, ti) => {
                  const cover = theme.image || movieById.get(theme.movieIds[0] ?? "")?.poster || "";
                  return (
                    <div
                      key={theme.id}
                      id={`theme-${theme.id}`}
                      className={`border p-3 ${theme.hidden ? "border-dashed border-[rgba(120,120,140,0.45)] opacity-70" : "border-[var(--hairline)]"}`}
                      style={{ background: "rgba(11,13,20,0.7)" }}
                    >
                      <div className="flex gap-3">
                        <div className="relative h-[92px] w-[64px] shrink-0 overflow-hidden border border-[var(--hairline)] bg-[rgba(20,22,30,0.8)]">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cover} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[0.6rem] text-[var(--color-ash-dim)]">无图</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <input
                            className={input}
                            value={theme.name}
                            onChange={(e) => {
                              const v = e.target.value;
                              setConfig((c) => ({
                                ...c,
                                sections: c.sections.map((s) =>
                                  s.id === section.id ? { ...s, themes: s.themes.map((t) => (t.id === theme.id ? { ...t, name: v } : t)) } : s
                                ),
                              }));
                            }}
                            onBlur={() => void saveStructure(config, "已修改主题名称")}
                            aria-label="主题名称"
                          />
                          <div className="mt-2 flex items-center justify-between text-[0.68rem] text-[var(--color-ash-dim)]">
                            <span>{theme.movieIds.length} 部</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button className={btn} onClick={() => moveTheme(section.id, ti, -1)} disabled={busy || ti === 0}>
                                ↑
                              </button>
                              <button className={btn} onClick={() => moveTheme(section.id, ti, 1)} disabled={busy || ti === section.themes.length - 1}>
                                ↓
                              </button>
                              <button
                                className={btn}
                                onClick={() =>
                                  mutate((d) => {
                                    const s = d.sections.find((x) => x.id === section.id);
                                    const t = s?.themes.find((x) => x.id === theme.id);
                                    if (t) t.hidden = !t.hidden;
                                  }, theme.hidden ? "已恢复主题" : "已隐藏主题")
                                }
                                disabled={busy}
                              >
                                {theme.hidden ? "恢复" : "隐藏"}
                              </button>
                              <button className={btn} onClick={() => deleteTheme(theme)} disabled={busy}>
                                删除
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button className={btn} onClick={() => setOpenThemeId(openThemeId === theme.id ? null : theme.id)}>
                          {openThemeId === theme.id ? "收起电影" : "管理电影"}
                        </button>
                        <label className="flex items-center gap-1.5 text-[0.68rem] text-[var(--color-ash-dim)]">
                          移到
                          <select
                            className="border border-[var(--hairline)] bg-[rgba(8,10,16,0.8)] px-1.5 py-1 text-[0.68rem] text-ivory"
                            value={section.id}
                            onChange={(e) => moveThemeToSection(theme.id, e.target.value)}
                            aria-label="移动到板块"
                          >
                            {config.sections.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <input
                          className={`${input} text-[0.7rem]`}
                          placeholder="主题图片地址，例如 /posters-douban/coraline.jpg"
                          value={theme.image}
                          onChange={(e) => {
                            const v = e.target.value;
                            setConfig((c) => ({
                              ...c,
                              sections: c.sections.map((s) =>
                                s.id === section.id ? { ...s, themes: s.themes.map((t) => (t.id === theme.id ? { ...t, image: v } : t)) } : s
                              ),
                            }));
                          }}
                          onBlur={() => void saveStructure(config, "已更新主题图片")}
                          aria-label="主题图片地址"
                        />
                      </div>

                      {openTheme && openTheme.theme.id === theme.id && (
                        <div className="mt-3 border-t border-[var(--hairline)] pt-3" id="movies">
                          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">
                            {theme.movieIds.length} 部作品 · 同板块内一部电影只属于一个主题
                          </p>

                          <div className="mt-2 max-h-[180px] space-y-1 overflow-auto pr-1">
                            {theme.movieIds.length === 0 && <p className="text-[0.72rem] text-[var(--color-ash-dim)]">还没有电影。</p>}
                            {theme.movieIds.map((mid) => {
                              const m = movieById.get(mid);
                              return (
                                <div key={mid} className="flex items-center justify-between gap-2 text-[0.74rem] text-[var(--color-ivory-dim)]">
                                  <span className="truncate">
                                    {m ? `${m.title}（${m.year}）` : mid}
                                  </span>
                                  <button
                                    className={btn}
                                    onClick={() => void action({ type: "removeMovie", themeId: theme.id, movieId: mid }, "已移除电影（仅解除关联）")}
                                    disabled={busy}
                                  >
                                    移除
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <input
                              className={input}
                              placeholder="搜索电影名 / 原名 / 年份，勾选后批量加入"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                            <button className={btnPrimary} onClick={() => void addPicked(theme)} disabled={busy}>
                              加入勾选
                            </button>
                          </div>

                          <div className="mt-2 max-h-[220px] space-y-1 overflow-auto pr-1">
                            {searchResults.map((m) => {
                              const already = theme.movieIds.includes(m.id);
                              return (
                                <label key={m.id} className="flex items-center gap-2 text-[0.74rem] text-[var(--color-ivory-dim)]">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(picks[m.id])}
                                    disabled={already}
                                    onChange={(e) => setPicks((p) => ({ ...p, [m.id]: e.target.checked }))}
                                  />
                                  <span className="truncate">
                                    {m.title}（{m.year}）{already ? " · 已在本主题" : ""}
                                  </span>
                                  <button
                                    type="button"
                                    className={`${btn} ml-auto`}
                                    onClick={() => void action({ type: "setImage", themeId: theme.id, image: m.poster }, `已把主题图片换成《${m.title}》的海报`)}
                                    disabled={busy || !m.poster}
                                  >
                                    用其海报做封面
                                  </button>
                                </label>
                              );
                            })}
                            {search.trim() && searchResults.length === 0 && (
                              <p className="text-[0.72rem] text-[var(--color-ash-dim)]">没有匹配的电影。</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}

        {config.sections.length === 0 && (
          <p className="text-[0.85rem] text-[var(--color-ivory-dim)]">
            当前没有任何板块，首页只显示品牌首屏与命运抽取。点右上角「新增板块」开始配置。
          </p>
        )}
      </div>
    </div>
  );
}
