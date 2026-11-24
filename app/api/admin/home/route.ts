import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { getKv } from "@/lib/admin/kv";
import { getMoviesRuntime } from "@/lib/admin/store-kv";
import { loadHomeConfig, saveHomeConfig, type HomeConfig } from "@/lib/home-config";
import { loadHomeConfigRuntime, saveHomeConfigKv } from "@/lib/home-config-kv";

/** GET /api/admin/home → 首页配置 + 电影库统计 */
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  try {
    const kv = await getKv();
    const config = kv ? await loadHomeConfigRuntime() : loadHomeConfig();
    const movies = (await getMoviesRuntime()).length;
    return NextResponse.json({ ok: true, config, libraryCount: movies, storage: kv ? "kv" : "file" });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PUT /api/admin/home → 保存整份结构配置（线上写 KV，本机写文件并备份） */
export async function PUT(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { config?: HomeConfig };
    if (!body?.config || !Array.isArray(body.config.sections)) {
      return NextResponse.json({ ok: false, error: "配置格式不正确" }, { status: 422 });
    }
    const kv = await getKv();
    if (kv) {
      const result = await saveHomeConfigKv(body.config);
      return NextResponse.json({ ok: true, ...result, backup: null, storage: "kv" });
    }
    const result = saveHomeConfig(body.config);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
