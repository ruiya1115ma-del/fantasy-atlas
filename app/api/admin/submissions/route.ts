import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { listSubmissionsWithFlags } from "@/lib/admin/submissions";
import type { Submission } from "@/lib/submissions";

const STATUSES = ["pending", "approved", "rejected"] as const;

/** GET /api/admin/submissions?status=pending */
export async function GET(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const raw = new URL(request.url).searchParams.get("status");
  const status = STATUSES.includes(raw as (typeof STATUSES)[number]) ? (raw as Submission["status"]) : undefined;

  try {
    const submissions = listSubmissionsWithFlags(status);
    return NextResponse.json({
      ok: true,
      counts: {
        pending: listSubmissionsWithFlags("pending").length,
        approved: listSubmissionsWithFlags("approved").length,
        rejected: listSubmissionsWithFlags("rejected").length,
      },
      submissions,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
