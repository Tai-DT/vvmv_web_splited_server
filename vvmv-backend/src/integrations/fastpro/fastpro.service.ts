import { Injectable } from "@nestjs/common";

@Injectable()
export class FastproService {
  async call<T = unknown>(path: string, body: unknown) {
    const baseUrl = process.env.FASTPRO_BASE_URL?.replace(/\/$/, "");
    const apiKey = process.env.FASTPRO_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error("FASTPRO_BASE_URL/FASTPRO_API_KEY is not configured");
    }

    const response = await fetch(`${baseUrl}/${path.replace(/^\//, "")}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await response.json().catch(() => ({}))) as T;
    return { ok: response.ok, status: response.status, data };
  }

  finishLogistic(body: unknown) {
    return this.call("finish-logistic", body);
  }

  importFee(body: unknown) {
    return this.call("import-fee", body);
  }

  unfinishTrucking(body: unknown) {
    return this.call("unfinish-trucking", body);
  }
}
