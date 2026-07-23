export const codeShiftOpenApi = {
  openapi: "3.1.0",
  info: {
    title: "CodeShift AI API",
    version: "1.0.0",
    description: "Governed repository modernization control-plane API.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ signedIdentity: [] }],
  paths: {
    "/health/live": {
      get: { operationId: "getLiveness", security: [], responses: { "200": { description: "Process is live." } } },
    },
    "/health/ready": {
      get: { operationId: "getReadiness", security: [], responses: {
        "200": { description: "Runtime is ready." },
        "503": { description: "Required configuration or dependency is unavailable." },
      } },
    },
    "/recipes": {
      get: {
        operationId: "listRecipes",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "filter", in: "query", schema: { type: "string", maxLength: 100 } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
        ],
        responses: { "200": { description: "Paginated recipe catalog." } },
      },
    },
    "/repos/analyze": {
      post: { operationId: "analyzeRepository", responses: {
        "200": { description: "Repository analysis." },
        "400": { $ref: "#/components/responses/Error" },
      } },
    },
    "/plans/generate": {
      post: { operationId: "generatePlan", responses: {
        "200": { description: "Migration plan." },
        "422": { $ref: "#/components/responses/Error" },
      } },
    },
    "/campaigns": {
      get: { operationId: "listCampaigns", responses: { "200": { description: "Paginated campaigns." } } },
      post: {
        operationId: "createCampaign",
        parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } }],
        responses: {
          "201": { description: "Campaign created." },
          "400": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/approvals": {
      post: { operationId: "approveExecution", responses: {
        "201": { description: "Approval recorded." },
        "403": { $ref: "#/components/responses/Error" },
      } },
    },
    "/runners/revoke": {
      post: { operationId: "revokeRunner", responses: { "200": { description: "Runner revoked." } } },
    },
    "/integrations/github/pull-requests": {
      post: { operationId: "queuePullRequest", responses: {
        "202": { description: "Approved pull request queued." },
        "400": { $ref: "#/components/responses/Error" },
      } },
    },
    "/integrations/github/webhook": {
      post: { operationId: "receiveGitHubWebhook", security: [], responses: {
        "202": { description: "Verified webhook accepted." },
        "401": { $ref: "#/components/responses/Error" },
      } },
    },
    "/settings/ai-credentials": {
      post: { operationId: "storeAiCredential", responses: { "201": { description: "Encrypted credential stored." } } },
    },
    "/usage": {
      get: { operationId: "getUsage", responses: { "200": { description: "Workspace usage and limits." } } },
    },
    "/metrics": {
      get: { operationId: "getMetrics", responses: { "200": { description: "Protected operational metrics." } } },
    },
  },
  components: {
    securitySchemes: {
      signedIdentity: {
        type: "apiKey",
        in: "header",
        name: "X-CodeShift-Identity-Signature",
        description: "HMAC signature supplied by the trusted identity gateway.",
      },
    },
    responses: {
      Error: {
        description: "Stable error response.",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["error"],
              properties: {
                error: {
                  type: "object",
                  required: ["code", "message", "requestId"],
                  properties: {
                    code: { type: "string" },
                    message: { type: "string" },
                    requestId: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
