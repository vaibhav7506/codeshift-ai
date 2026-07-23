export interface ApiBehaviourObservation {
  method: string;
  path: string;
  requestBody?: unknown;
  query?: Record<string, string | string[]>;
  requestHeaders?: Record<string, string>;
  status: number;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  authenticationState?: string;
  middlewareTrace?: string[];
}

export interface ApiParityDifference {
  route: string;
  field:
    | "missing-route"
    | "status"
    | "response-body"
    | "response-headers"
    | "authentication"
    | "middleware-order";
  before: unknown;
  after: unknown;
  message: string;
}

export interface ApiParityReport {
  routeParity: { passed: number; total: number };
  responseParity: { passed: number; total: number };
  middlewareParity: { passed: number; total: number };
  differences: ApiParityDifference[];
  passed: boolean;
}

export function compareApiBehaviour(
  baseline: readonly ApiBehaviourObservation[],
  migrated: readonly ApiBehaviourObservation[],
): ApiParityReport {
  const migratedByKey = new Map(
    migrated.map((observation) => [routeKey(observation), observation]),
  );
  const differences: ApiParityDifference[] = [];
  let routePassed = 0;
  let responsePassed = 0;
  let middlewarePassed = 0;

  for (const before of baseline) {
    const key = routeKey(before);
    const after = migratedByKey.get(key);
    if (!after) {
      differences.push({
        route: key,
        field: "missing-route",
        before,
        after: undefined,
        message: `${key} was present before migration but is missing afterward.`,
      });
      continue;
    }
    routePassed += 1;

    const responseDifferencesBefore = differences.length;
    if (before.status !== after.status) {
      differences.push({
        route: key,
        field: "status",
        before: before.status,
        after: after.status,
        message: `${key} returned ${before.status} before migration and ${after.status} afterward.`,
      });
    }
    if (!deepEqual(before.responseBody, after.responseBody)) {
      differences.push({
        route: key,
        field: "response-body",
        before: before.responseBody,
        after: after.responseBody,
        message: `${key} returned a different response body.`,
      });
    }
    if (!headersEqual(before.responseHeaders, after.responseHeaders)) {
      differences.push({
        route: key,
        field: "response-headers",
        before: before.responseHeaders,
        after: after.responseHeaders,
        message: `${key} returned different response headers.`,
      });
    }
    if (before.authenticationState !== after.authenticationState) {
      differences.push({
        route: key,
        field: "authentication",
        before: before.authenticationState,
        after: after.authenticationState,
        message: `${key} changed authentication behaviour.`,
      });
    }
    if (differences.length === responseDifferencesBefore) responsePassed += 1;

    if (deepEqual(before.middlewareTrace ?? [], after.middlewareTrace ?? [])) {
      middlewarePassed += 1;
    } else {
      differences.push({
        route: key,
        field: "middleware-order",
        before: before.middlewareTrace,
        after: after.middlewareTrace,
        message: `${key} executed middleware in a different order.`,
      });
    }
  }

  return {
    routeParity: { passed: routePassed, total: baseline.length },
    responseParity: { passed: responsePassed, total: baseline.length },
    middlewareParity: { passed: middlewarePassed, total: baseline.length },
    differences,
    passed: differences.length === 0,
  };
}

export interface FrontendBehaviourObservation {
  route: string;
  viewport: string;
  screenshotHash: string;
  domSnapshot: string;
  consoleErrors: string[];
  networkFailures: string[];
  criticalInteractions: Array<{ name: string; passed: boolean }>;
  computedStyles: Record<string, Record<string, string>>;
  accessibilityViolations: Array<{ rule: string; target: string }>;
}

export interface FrontendParityReport {
  passed: boolean;
  routes: Array<{
    route: string;
    viewport: string;
    screenshotMatched: boolean;
    domMatched: boolean;
    interactionParity: boolean;
    styleParity: boolean;
    newConsoleErrors: string[];
    newNetworkFailures: string[];
    newAccessibilityViolations: Array<{ rule: string; target: string }>;
  }>;
}

export function compareFrontendBehaviour(
  baseline: readonly FrontendBehaviourObservation[],
  migrated: readonly FrontendBehaviourObservation[],
): FrontendParityReport {
  const afterByKey = new Map(
    migrated.map((entry) => [`${entry.route}:${entry.viewport}`, entry]),
  );
  const routes = baseline.map((before) => {
    const after = afterByKey.get(`${before.route}:${before.viewport}`);
    if (!after) {
      return {
        route: before.route,
        viewport: before.viewport,
        screenshotMatched: false,
        domMatched: false,
        interactionParity: false,
        styleParity: false,
        newConsoleErrors: ["Route observation is missing."],
        newNetworkFailures: [],
        newAccessibilityViolations: [],
      };
    }

    return {
      route: before.route,
      viewport: before.viewport,
      screenshotMatched: before.screenshotHash === after.screenshotHash,
      domMatched: normalizeDom(before.domSnapshot) === normalizeDom(after.domSnapshot),
      interactionParity: before.criticalInteractions.every((interaction) =>
        after.criticalInteractions.some(
          (candidate) =>
            candidate.name === interaction.name &&
            candidate.passed === interaction.passed,
        ),
      ),
      styleParity: deepEqual(before.computedStyles, after.computedStyles),
      newConsoleErrors: difference(after.consoleErrors, before.consoleErrors),
      newNetworkFailures: difference(after.networkFailures, before.networkFailures),
      newAccessibilityViolations: after.accessibilityViolations.filter(
        (violation) =>
          !before.accessibilityViolations.some(
            (existing) =>
              existing.rule === violation.rule &&
              existing.target === violation.target,
          ),
      ),
    };
  });

  return {
    passed: routes.every(
      (route) =>
        route.screenshotMatched &&
        route.domMatched &&
        route.interactionParity &&
        route.styleParity &&
        route.newConsoleErrors.length === 0 &&
        route.newNetworkFailures.length === 0 &&
        route.newAccessibilityViolations.length === 0,
    ),
    routes,
  };
}

function routeKey(observation: ApiBehaviourObservation): string {
  return `${observation.method.toUpperCase()} ${observation.path}`;
}

function headersEqual(
  left: Record<string, string> | undefined,
  right: Record<string, string> | undefined,
): boolean {
  return deepEqual(normalizeHeaders(left), normalizeHeaders(right));
}

function normalizeHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers ?? {})
      .filter(([name]) => !["date", "server", "x-request-id"].includes(name.toLowerCase()))
      .map(([name, value]) => [name.toLowerCase(), value])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function deepEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeDom(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function difference(values: readonly string[], baseline: readonly string[]): string[] {
  return values.filter((value) => !baseline.includes(value));
}
