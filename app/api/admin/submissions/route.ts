import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { getKv } from "@/lib/admin/kv";
import { listSubmissionsWithFlags } from "@/lib/admin/submissions";
import { getMoviesRuntime } from "@/lib/admin/store-kv";
import type { Submission } from "@/lib/submissions";
import { listSubmissionsWithFlagsKv } from "@/lib/submissions-kv";

const STATUSES = ["pending", "approved", "rejected"] as const;

/** GET /api/admin/submissions?status=pending —— 线上读 KV，本机读文件 */
export async function GET(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const raw = new URL(request.url).searchParams.get("status");
  const status = STATUSES.includes(raw as (typeof STATUSES)[number]) ? (raw as Submission["status"]) : undefined;

  try {
    const kv = await getKv();
    if (kv) {
      const movies = (await getMoviesRuntime()).map((m) => ({
        id: m.id,
        chineseTitle: m.chineseTitle,
        originalTitle: m.originalTitle,
        releaseYear: m.releaseYear,
      }));
      const all = await listSubmissionsWithFlagsKv(movies);
      return NextResponse.json({
        ok: true,
        storage: "kv",
        counts: {
          pending: all.filter((s) => s.status === "pending").length,
          approved: all.filter((s) => s.status === "approved").length,
          rejected: all.filter((s) => s.status === "rejected").length,
        },
        submissions: status ? all.filter((s) => s.status === status) : all,
      });
    }

    return NextResponse.json({
      ok: true,
      counts: {
        pending: listSubmissionsWithFlags("pending").length,
        approved: listSubmissionsWithFlags("approved").length,
        rejected: listSubmissionsWithFlags("rejected").length,
      },
      submissions: listSubmissionsWithFlags(status),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
