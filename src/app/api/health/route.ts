import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { redis } from "@/server/redis";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const [db, cache] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);
  const status = db.status === "fulfilled" && cache.status === "fulfilled" ? 200 : 503;
  return NextResponse.json(
    {
      db: db.status === "fulfilled" ? "ok" : "fail",
      redis: cache.status === "fulfilled" ? "ok" : "fail",
    },
    { status },
  );
}
