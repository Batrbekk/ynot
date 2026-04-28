import { NextResponse } from "next/server";
import { searchProducts } from "@/server/data/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchProducts(query);
  return NextResponse.json({ results });
}
