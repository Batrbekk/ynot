import { NextResponse } from "next/server";
import { signOut } from "@/server/auth/nextauth";
import { assertCsrf } from "@/server/auth/csrf";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }
  await signOut({ redirect: false });
  return NextResponse.json({ ok: true });
}
