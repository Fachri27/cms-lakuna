import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query || query.trim().length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "id" },
    });

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const text = await res.text();
    const data = JSON.parse(text);
    const suggestions: string[] = data[1] || [];

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
