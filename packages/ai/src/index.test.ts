import assert from "node:assert/strict";
import test from "node:test";
import type { MigrationSummary } from "@codeshift/shared";
import {
  AIProviderError,
  createAIProvider,
  createOpenAIProvider,
  isAIProviderImplemented,
} from "./index.js";

const migrationSummary: MigrationSummary = {
  target: "JS_TO_TS",
  selectedScope: "src/utils",
  changedFiles: ["src/utils/format.ts"],
  warnings: [],
  tsconfigChanged: false,
  createdAt: "2026-07-03T00:00:00.000Z",
};

test("OpenAI patch explanation uses BYOK, structured output, and no response storage", async () => {
  let requestURL = "";
  let requestInit: RequestInit | undefined;
  const fetchImplementation: typeof fetch = async (input, init) => {
    requestURL = String(input);
    requestInit = init;

    return new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  summary: "Converted one utility module.",
                  scopeAssessment: "The patch remains within src/utils.",
                  changes: [
                    {
                      file: "src/utils/format.ts",
                      explanation: "Converted the module export.",
                    },
                  ],
                  risks: [],
                }),
              },
            ],
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
  const provider = createOpenAIProvider({
    apiKey: "test-openai-key",
    fetchImplementation,
  });

  const explanation = await provider.explainPatch({
    selectedScope: "src/utils",
    patch: "diff --git a/src/utils/format.js b/src/utils/format.ts",
    migrationSummary,
  });

  assert.equal(requestURL, "https://api.openai.com/v1/responses");
  assert.equal(
    new Headers(requestInit?.headers).get("Authorization"),
    "Bearer test-openai-key",
  );

  const body = JSON.parse(String(requestInit?.body)) as {
    model: string;
    input: string;
    store: boolean;
    text: { format: { type: string; strict: boolean } };
  };
  assert.equal(body.model, "gpt-5.4-mini");
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.match(body.input, /src\/utils/);
  assert.equal(explanation.changes[0]?.file, "src/utils/format.ts");
});

test("providers reject missing keys without exposing a credential", () => {
  assert.throws(
    () => createAIProvider("openai", { apiKey: " " }),
    (error: unknown) =>
      error instanceof AIProviderError &&
      error.code === "MISSING_API_KEY" &&
      !error.message.includes("Bearer"),
  );
});

test("provider architecture exposes clean stubs for future adapters", async () => {
  assert.equal(isAIProviderImplemented("openai"), true);
  assert.equal(isAIProviderImplemented("groq"), false);
  assert.equal(isAIProviderImplemented("gemini"), false);
  assert.equal(isAIProviderImplemented("anthropic"), false);

  const provider = createAIProvider("groq", { apiKey: "test-groq-key" });
  await assert.rejects(
    provider.explainPatch({
      selectedScope: "src/utils",
      patch: "",
      migrationSummary,
    }),
    (error: unknown) =>
      error instanceof AIProviderError &&
      error.code === "PROVIDER_NOT_IMPLEMENTED",
  );
});

test("type-fix suggestions outside the selected scope are rejected", async () => {
  const provider = createOpenAIProvider({
    apiKey: "test-openai-key",
    fetchImplementation: async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    suggestions: [
                      {
                        file: "src/auth/session.ts",
                        issue: "Implicit any.",
                        suggestion: "Add a narrow parameter type.",
                        confidence: "HIGH",
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
  });

  await assert.rejects(
    provider.suggestTypeFixes({
      selectedScope: "src/utils",
      diagnostics: "Parameter has an implicit any type.",
    }),
    /outside the selected scope/,
  );
});
