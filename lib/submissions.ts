/**
 * 投稿存储（仅服务端使用）：
 *   data/submissions/submissions.json —— 所有投稿（pending / approved / rejected）
 *
 * 设计原则：
 *   - 投稿永不直接写入 data/raw（创作者的原始片单只有管理员能动）。
 *   - 通过审核的投稿进入 approved.json，再由 scripts/promote-submissions.mjs
 *     转成 raw 记录（需要人工补标签与简介），最后 npm run merge 才进入正式库。
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "data", "submissions");
const FILE = path.join(DIR, "submissions.json");

export const submissionSchema = z.object({
  chineseTitle: z.string().trim().min(1, "请填写中文片名").max(60),
  originalTitle: z.string().trim().max(120).optional().default(""),
  releaseYear: z.coerce.number().int().min(1900).max(2100).optional(),
  doubanUrl: z
    .string()
    .trim()
    .regex(/douban\.com\/subject\/\d+/, "请填写豆瓣条目链接，例如 https://movie.douban.com/subject/1291561/"),
  note: z.string().trim().max(400, "补充说明最多 400 字").optional().default(""),
  submitter: z.string().trim().max(40).optional().default("anonymous"),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

export interface Submission extends SubmissionInput {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

interface Store {
  submissions: Submission[];
}

function ensure() {
  fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ submissions: [] }, null, 2), "utf8");
}

export function readStore(): Store {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
    return { submissions: Array.isArray(raw.submissions) ? raw.submissions : [] };
  } catch {
    return { submissions: [] };
  }
}

function writeStore(store: Store) {
  ensure();
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, FILE);
}

export function addSubmission(input: SubmissionInput): Submission {
  const store = readStore();
  const sub: Submission = {
    ...input,
    id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store.submissions.unshift(sub);
  writeStore(store);
  return sub;
}

export function reviewSubmission(id: string, action: "approve" | "reject", reviewNote?: string): Submission | null {
  const store = readStore();
  const sub = store.submissions.find((s) => s.id === id);
  if (!sub) return null;
  sub.status = action === "approve" ? "approved" : "rejected";
  sub.reviewedAt = new Date().toISOString();
  if (reviewNote) sub.reviewNote = reviewNote.slice(0, 200);
  writeStore(store);
  return sub;
}

export function listSubmissions(status?: Submission["status"]): Submission[] {
  const all = readStore().submissions;
  return status ? all.filter((s) => s.status === status) : all;
}

/** 管理口令：默认本地开发口令，正式部署时用环境变量覆盖 */
export function adminToken(): string {
  return process.env.ADMIN_TOKEN || "fantasy-atlas-admin";
}
