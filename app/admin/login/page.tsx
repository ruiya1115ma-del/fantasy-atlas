import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { isAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "管理员登录",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <div className="shell max-w-3xl pb-24 pt-16">
      <p className="eyebrow">Admin · Sign in</p>
      <h1 className="display mt-4 text-4xl text-ivory">管理员登录</h1>
      <p className="lede mt-4 max-w-xl text-[0.9rem]">
        这里是作者自己的后台，普通访客看不到入口。账号密码由服务端环境变量配置，
        登录状态保存在一枚 HttpOnly Cookie 里，有效期 7 天。
      </p>
      <AdminLoginForm />
      <p className="mt-10 text-[0.72rem] leading-relaxed text-[var(--color-ash-dim)]">
        首次使用：在项目根目录的 <code className="text-[var(--color-ivory-dim)]">.env.local</code> 里设置
        <code className="ml-1 text-[var(--color-ivory-dim)]">ADMIN_USER</code> 与
        <code className="ml-1 text-[var(--color-ivory-dim)]">ADMIN_PASSWORD</code>，重启 dev server 后即可登录。
        具体说明见 <code className="text-[var(--color-ivory-dim)]">docs/ADMIN.md</code>。
      </p>
    </div>
  );
}
