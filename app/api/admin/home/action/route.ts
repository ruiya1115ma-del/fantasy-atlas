import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { loadHomeConfig, saveHomeConfig } from "@/lib/home-config";
import { getMovies } from "@/lib/data";

/**
 * POST /api/admin/home/action
 * 电影归属相关操作（结构变更走 PUT /api/admin/home）：
 *   { type: "addMovies", themeId, movieIds: string[] }  → 加入主题（同板块内会自动从其它主题移出）
 *   { type: "removeMovie", themeId, movieId }           → 只解除关联，不删除电影资料
 *   { type: "setImage", themeId, image }                → 更换主题图片
 */
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      type?: string;
      themeId?: string;
      movieIds?: string[];
      movieId?: string;
      image?: string;
    };
    const config = loadHomeConfig();
    const validIds = new Set(getMovies().map((m) => m.id));

    const section = config.sections.find((s) => s.themes.some((t) => t.id === body.themeId));
    const theme = section?.themes.find((t) => t.id === body.themeId);
    if (!section || !theme) {
      return NextResponse.json({ ok: false, error: "主题不存在或已被删除" }, { status: 404 });
    }

    let movedFrom: string[] = [];

    if (body.type === "addMovies") {
      const incoming = (Array.isArray(body.movieIds) ? body.movieIds : []).map(String).filter((id) => validIds.has(id));
      if (!incoming.length) {
        return NextResponse.json({ ok: false, error: "没有可加入的有效电影" }, { status: 422 });
      }
      // 同一板块内：一部电影只能属于一个主题 —— 先从其它主题移出，再并入目标主题
      for (const other of section.themes) {
        if (other.id === theme.id) continue;
        const before = other.movieIds.length;
        other.movieIds = other.movieIds.filter((id) => !incoming.includes(id));
        if (other.movieIds.length !== before) movedFrom.push(other.name);
      }
      for (const id of incoming) {
        if (!theme.movieIds.includes(id)) theme.movieIds.push(id);
      }
    } else if (body.type === "removeMovie") {
      const movieId = String(body.movieId ?? "");
      theme.movieIds = theme.movieIds.filter((id) => id !== movieId);
    } else if (body.type === "setImage") {
      theme.image = String(body.image ?? "").trim();
    } else {
      return NextResponse.json({ ok: false, error: "未知操作类型" }, { status: 422 });
    }

    const result = saveHomeConfig(config);
    const saved = result.config.sections.find((s) => s.id === section.id)?.themes.find((t) => t.id === theme.id);
    return NextResponse.json({
      ok: true,
      config: result.config,
      movieIds: saved?.movieIds ?? [],
      movedFrom,
      duplicateDropped: result.duplicates,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
