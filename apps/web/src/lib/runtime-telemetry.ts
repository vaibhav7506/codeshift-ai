import {
  JsonConsoleTelemetrySink,
  StructuredTelemetry,
} from "@codeshift/platform/enterprise-runtime";

const globalTelemetry = globalThis as typeof globalThis & {
  codeShiftTelemetry?: StructuredTelemetry;
};

export const telemetry = globalTelemetry.codeShiftTelemetry ??=
  new StructuredTelemetry(new JsonConsoleTelemetrySink());

export async function withHttpTelemetry<T>(
  request: Request,
  name: string,
  operation: () => Promise<T> | T,
): Promise<T> {
  const span = telemetry.start({
    kind: "HTTP_REQUEST",
    name,
    correlationId:
      request.headers.get("x-correlation-id") ??
      request.headers.get("x-request-id") ??
      crypto.randomUUID(),
    attributes: { method: request.method, path: new URL(request.url).pathname },
  });
  try {
    const result = await operation();
    span.end(true);
    return result;
  } catch (error) {
    span.end(false, { errorType: error instanceof Error ? error.name : "Unknown" });
    throw error;
  }
}
