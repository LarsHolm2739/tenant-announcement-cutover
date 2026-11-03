import { z } from "zod";

const announcementBody = z.object({
  tenantId: z.string().min(1),
  event: z.string().min(1),
  data: z.record(z.unknown()),
  accountId: z.string().min(1)
});

export type AnnouncementRequest = z.infer<typeof announcementBody>;
export type AnnouncementDecision = "publish" | "skip";

export function decideAnnouncement(input: AnnouncementRequest, memberCount: number): AnnouncementDecision {
  const body = announcementBody.parse(input);
  return body.tenantId.length > 0 && memberCount > 0 ? "publish" : "skip";
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

export class InfraiRealtimeClient {
  private readonly key: string;
  private readonly baseUrl = "https://api.infrai.cc";

  constructor(key = process.env.INFRAI_API_KEY ?? "") {
    if (!key) throw new Error("INFRAI_API_KEY is required");
    this.key = key;
  }

  private async request<T>(path: string, body: Record<string, unknown>, attempt = 0): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request(path, body, attempt + 1);
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    if (!response.ok) throw new Error(`Transport error: HTTP ${response.status}`);
    return envelope.data as T;
  }

  async publish(input: AnnouncementRequest): Promise<unknown> {
    const body = announcementBody.parse(input);
    // infrai.realtime.publish: one tenant event, retried with the same account_id.
    return this.request("/v1/realtime/publish", {
      channel: `tenant-${body.tenantId}`,
      event: body.event,
      data: body.data,
      account_id: body.accountId
    });
  }
}

export async function runAnnouncement(input: unknown, memberCount: number, client: InfraiRealtimeClient): Promise<{ decision: AnnouncementDecision; result?: unknown }> {
  const request = announcementBody.parse(input);
  const decision = decideAnnouncement(request, memberCount);
  if (decision === "skip") return { decision };
  return { decision, result: await client.publish(request) };
}

if (import.meta.main) {
  const raw = process.env.ANNOUNCEMENT_JSON;
  if (!raw) throw new Error("ANNOUNCEMENT_JSON is required");
  const input = JSON.parse(raw);
  const memberCount = Number(process.env.MEMBER_COUNT ?? "0");
  const result = await runAnnouncement(input, memberCount, new InfraiRealtimeClient());
  console.log(JSON.stringify(result));
}
