import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
};
