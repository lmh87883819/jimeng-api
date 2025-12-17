import _ from "lodash";

import Request from "@/lib/request/Request.ts";
import tokenScheduler, { TokenLease } from "@/lib/token-scheduler.ts";
import config from "@/lib/config.ts";

function splitAuthorization(authorization: string): string[] {
  return authorization
    .replace(/^Bearer\s+/i, "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function hasStaticTokens() {
  return (config.system.tokens || []).length > 0;
}

export function getStaticTokens() {
  return config.system.tokens || [];
}

export async function acquireRequestToken(
  request: Request
): Promise<TokenLease & { source: "config" | "authorization" }> {
  if (hasStaticTokens()) {
    const lease = await tokenScheduler.acquire();
    return { ...lease, source: "config" };
  }

  request.validate("headers.authorization", _.isString);
  const tokens = splitAuthorization(request.headers.authorization);
  const token = _.sample(tokens);
  if (!token) throw new Error("Authorization is present but no token was found");
  return { token, release: () => {}, source: "authorization" };
}

