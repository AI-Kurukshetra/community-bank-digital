import { requireRouteSession } from "@/lib/route-helpers";

export async function POST() {
  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  return new Response(null, { status: 204 });
}
