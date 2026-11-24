import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { loadHomeConfig, saveHomeConfig, type HomeConfig } from "@/lib/home-config";
import { getMovies } from "@/lib/data";

/** GET /api/admin/home → 首页配置 + 电影库统计 */
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  try {
    const config = loadHomeConfig();
    const movies = getMovies().length;
    return NextResponse.json({ ok: true, config, libraryCount: movies });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PUT /api/admin/home → 保存整份结构配置（板块/主题的增删改、排序、隐藏） */
export async function PUT(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { config?: HomeConfig };
    if (!body?.config || !Array.isArray(body.config.sections)) {
      return NextResponse.json({ ok: false, error: "配置格式不正确" }, { status: 422 });
    }
    const result = saveHomeConfig(body.config);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
