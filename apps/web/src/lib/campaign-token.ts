import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

interface CampaignTokenPayload {
  campaignId: string;
  workspaceId: string;
  expiresAt: number;
  nonce: string;
}

const tokenState = globalThis as typeof globalThis & {
  __codeshiftCampaignTokenSecret?: Buffer;
};

function secret(): Buffer {
  if (process.env.CODESHIFT_CAMPAIGN_TOKEN_SECRET) {
    return Buffer.from(process.env.CODESHIFT_CAMPAIGN_TOKEN_SECRET, "utf8");
  }
  return (
    tokenState.__codeshiftCampaignTokenSecret ??
    (tokenState.__codeshiftCampaignTokenSecret = randomBytes(32))
  );
}

export function issueCampaignToken(
  campaignId: string,
  workspaceId: string,
  ttlSeconds = 600,
): { token: string; expiresAt: string } {
  const payload: CampaignTokenPayload = {
    campaignId,
    workspaceId,
    expiresAt: Date.now() + ttlSeconds * 1000,
    nonce: randomBytes(12).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return {
    token: `${encoded}.${signature}`,
    expiresAt: new Date(payload.expiresAt).toISOString(),
  };
}

export function verifyCampaignToken(
  token: string,
  expectedCampaignId: string,
): CampaignTokenPayload {
  if (token.length > 4096) throw new Error("Campaign token is invalid.");
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new Error("Campaign token is invalid.");
  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Campaign token signature is invalid.");
  }
  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as Partial<CampaignTokenPayload>;
  if (
    payload.campaignId !== expectedCampaignId ||
    typeof payload.workspaceId !== "string" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= Date.now() ||
    typeof payload.nonce !== "string"
  ) {
    throw new Error("Campaign token is expired or invalid.");
  }
  return payload as CampaignTokenPayload;
}

export function redactCampaignToken(value: string): string {
  return value.replace(
    /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{20,}\b/g,
    "[REDACTED_CAMPAIGN_TOKEN]",
  );
}

function sign(encoded: string): string {
  return createHmac("sha256", secret()).update(encoded).digest("base64url");
}
