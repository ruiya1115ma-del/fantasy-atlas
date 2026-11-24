import { readCatalog } from "./store";
import { listSubmissions, type Submission } from "@/lib/submissions";

export interface SubmissionWithFlags extends Submission {
  /** 正式库里是否已有这部（按中文名 + 年份 / 原名判断） */
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

/** 给每条投稿补上「是否已收录」标记，供后台审核时一眼判断 */
export function listSubmissionsWithFlags(status?: Submission["status"]): SubmissionWithFlags[] {
  const movies = readCatalog().movies;
  const byTitle = new Map<string, { id: string; title: string }>();
  for (const movie of movies) {
    byTitle.set(`${normalize(movie.chineseTitle)}|${movie.releaseYear}`, { id: movie.id, title: movie.chineseTitle });
    if (movie.originalTitle) {
      byTitle.set(`${normalize(movie.originalTitle)}|${movie.releaseYear}`, { id: movie.id, title: movie.chineseTitle });
    }
  }

  return listSubmissions(status).map((sub) => {
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
    // 年份缺失时退化为标题匹配
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
