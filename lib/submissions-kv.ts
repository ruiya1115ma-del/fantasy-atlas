import { kvReadJson, kvWriteJson, KV_KEYS } from "@/lib/admin/kv";
import {
  addSubmission,
  listSubmissions,
  reviewSubmission,
  type Submission,
  type SubmissionInput,
} from "@/lib/submissions";

/**
 * 投稿的 KV 版读写（线上 Cloudflare Workers 用）。
 * 本地开发没有 KV 绑定，自动退回 lib/submissions.ts 的文件实现。
 */

interface Store {
  submissions: Submission[];
}

async function readStoreKv(): Promise<Store> {
  const data = await kvReadJson<Store>(KV_KEYS.submissions);
  return { submissions: Array.isArray(data?.submissions) ? data!.submissions : [] };
}

async function writeStoreKv(store: Store): Promise<void> {
  await kvWriteJson(KV_KEYS.submissions, store);
}

/** 提交一条投稿；返回 null 表示当前没有 KV（调用方走文件版） */
export async function addSubmissionKv(input: SubmissionInput): Promise<Submission | null> {
  const store = await readStoreKv();
  const sub: Submission = {
    ...input,
    id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store.submissions.unshift(sub);
  await writeStoreKv(store);
  return sub;
}

export async function listSubmissionsKv(status?: Submission["status"]): Promise<Submission[]> {
  const all = (await readStoreKv()).submissions;
  return status ? all.filter((s) => s.status === status) : all;
}

export async function reviewSubmissionKv(
  id: string,
  action: "approve" | "reject",
  reviewNote?: string,
): Promise<Submission | null> {
  const store = await readStoreKv();
  const sub = store.submissions.find((s) => s.id === id);
  if (!sub) return null;
  sub.status = action === "approve" ? "approved" : "rejected";
  sub.reviewedAt = new Date().toISOString();
  if (reviewNote) sub.reviewNote = reviewNote.slice(0, 200);
  await writeStoreKv(store);
  return sub;
}

export interface SubmissionWithFlags extends Submission {
  alreadyInLibrary: boolean;
  matchedId: string | null;
  matchedTitle: string | null;
}

function normalize(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/（\d{4}）|\(\d{4}\)/g, "")
    .replace(/[\s:：·・,，.。!！?？'"“”‘’\-_/]/g, "");
}

/** 后台审核用：补上「库里是否已有这部」的标记（KV 版） */
export async function listSubmissionsWithFlagsKv(
  movies: { id: string; chineseTitle: string; originalTitle: string; releaseYear: number }[],
  status?: Submission["status"],
): Promise<SubmissionWithFlags[]> {
  const all = await listSubmissionsKv(status);
  const byTitle = new Map<string, { id: string; title: string }>();
  for (const movie of movies) {
    byTitle.set(`${normalize(movie.chineseTitle)}|${movie.releaseYear}`, {
      id: movie.id,
      title: movie.chineseTitle,
    });
    if (movie.originalTitle) {
      byTitle.set(`${normalize(movie.originalTitle)}|${movie.releaseYear}`, {
        id: movie.id,
        title: movie.chineseTitle,
      });
    }
  }

  return all.map((sub) => {
    const candidates = [
      `${normalize(sub.chineseTitle)}|${sub.releaseYear ?? ""}`,
      sub.originalTitle ? `${normalize(sub.originalTitle)}|${sub.releaseYear ?? ""}` : "",
    ].filter(Boolean);

    let matched: { id: string; title: string } | null = null;
    for (const key of candidates) {
      const hit = byTitle.get(key);
      if (hit) {
        matched = hit;
        break;
      }
    }
    if (!matched) {
      const title = normalize(sub.chineseTitle);
      const hit = movies.find((m) => normalize(m.chineseTitle) === title || normalize(m.originalTitle) === title);
      if (hit) matched = { id: hit.id, title: hit.chineseTitle };
    }

    return {
      ...sub,
      alreadyInLibrary: Boolean(matched),
      matchedId: matched?.id ?? null,
      matchedTitle: matched?.title ?? null,
    };
  });
}

/** 本地文件版的兜底（KV 不可用时） */
export { addSubmission, listSubmissions, reviewSubmission };
