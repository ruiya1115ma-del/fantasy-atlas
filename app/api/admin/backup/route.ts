import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { backupCatalog, exportPayload, listBackups } from "@/lib/admin/store";

/** GET /api/admin/backup → 当前整库导出（浏览器直接下载 JSON） */
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const payload = exportPayload();
    const filename = `fantasy-atlas-catalog-${payload.exportedAt.slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/admin/backup → 手动生成一份快照，返回备份列表 */
export async function POST() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const name = backupCatalog("manual");
    return NextResponse.json({ ok: true, name, backups: listBackups().slice(0, 20) });
  } catch (err) {
    return errorResponse(err);
  }
}
