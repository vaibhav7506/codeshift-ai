import { apiError, requireApiPermission, secureJson } from "@/lib/enterprise-api";
import { telemetry } from "@/lib/runtime-telemetry";

export function GET(request: Request) {
  try {
    requireApiPermission(request, "AUDIT_READ");
    const memory = process.memoryUsage();
    telemetry.gauge("process.heap_used_bytes", memory.heapUsed);
    telemetry.gauge("process.rss_bytes", memory.rss);
    telemetry.gauge("process.uptime_seconds", Math.floor(process.uptime()));
    return secureJson({ metrics: telemetry.metrics() });
  } catch (error) {
    return apiError(error);
  }
}
