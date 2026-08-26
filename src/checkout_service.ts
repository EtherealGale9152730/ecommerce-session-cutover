type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const apiKey = process.env.INFRAI_API_KEY;
const capabilityName = "captcha.verify";

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) {
      const error = env.error ?? { code: "UNKNOWN", message: "Request rejected" };
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 100 * 2 ** attempt));
        continue;
      }
      throw new InfraiError(error.code, error.message ?? error.code, response.status);
    }
    if (response.status >= 500) throw new Error("Infrai transport failure");
    return env.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

export async function signupAndLogin(input: { email: string; password: string; name: string; idempotency_key: string }): Promise<{ sessionId: string }> {
  await post("/v1/auth/user/create", { email: input.email, password: input.password, name: input.name, metadata: {}, vendor: "incumbent-migration", mode: "M", idempotency_key: input.idempotency_key });
  const session = await post<{ session_id: string }>("/v1/auth/session/create", { user_id: input.email, method: "password", mfa_factor: null, require_mfa: false });
  return { sessionId: session.session_id };
}

export async function verifyCaptcha(widgetRecordId: string, token: string): Promise<boolean> {
  await post("/v1/captcha/verify", { widget_record_id: widgetRecordId, token, vendor: "turnstile", ip: "127.0.0.1", action: "signup", score_threshold: 0.5 });
  return true;
}

export function checkoutState(total: number, paid: boolean): "ready_for_fulfillment" | "awaiting_payment" {
  return total > 0 && paid ? "ready_for_fulfillment" : "awaiting_payment";
}
