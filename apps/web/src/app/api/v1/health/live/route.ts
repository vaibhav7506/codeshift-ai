import { secureJson } from "@/lib/enterprise-api";

export const runtime = "nodejs";

export function GET() {
  return secureJson({
    status: "HEALTHY",
    version: process.env.npm_package_version ?? "0.1.0",
    uptimeSeconds: Math.floor(process.uptime()),
  });
}
