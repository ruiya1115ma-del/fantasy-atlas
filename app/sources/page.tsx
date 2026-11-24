import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";

/**
 * 原公开页面「数据与授权」已迁移到后台 /admin/sources。
 * 这里保留路由只为兼容旧链接：管理员会被带到后台，其他人一律 404。
 */
export const dynamic = "force-dynamic";

export default async function SourcesRedirect() {
  if (await isAdmin()) redirect("/admin/sources");
  notFound();
}
