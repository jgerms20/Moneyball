import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/ui";

async function unlock(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "");
  if (code && code === process.env.TRADER_MIRROR_ACCESS_CODE) {
    const jar = await cookies();
    jar.set("tm_access", code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect(String(formData.get("from") || "/"));
  }
  redirect("/unlock?bad=1");
}

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; bad?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto mt-24 max-w-sm">
      <PageHeader kicker="private" title="This mirror is yours alone." />
      <form action={unlock} className="card flex flex-col gap-3 p-6">
        <input type="hidden" name="from" value={sp.from ?? "/"} />
        <label className="text-xs uppercase tracking-widest text-faint">Access code</label>
        <input
          name="code"
          type="password"
          autoFocus
          className="rounded-md border border-line bg-surface2 px-3 py-2 text-foreground outline-none focus:border-brass"
        />
        {sp.bad ? <p className="text-xs text-loss">That was not the code.</p> : null}
        <button
          type="submit"
          className="mt-2 rounded-md bg-brass px-4 py-2 font-medium text-background hover:bg-brass-bright"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
