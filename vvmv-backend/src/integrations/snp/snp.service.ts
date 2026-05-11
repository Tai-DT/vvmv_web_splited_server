import { Injectable } from "@nestjs/common";

@Injectable()
export class SnpService {
  async lookupContainer(body: unknown) {
    const url = process.env.SNP_LOOKUP_URL || process.env.SNP_API_URL;
    const cookie = process.env.SNP_SESSION_COOKIE;
    if (!url || !cookie) {
      throw new Error("SNP_LOOKUP_URL/SNP_SESSION_COOKIE is not configured");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(body ?? {}),
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      body: tryJson(text),
    };
  }
}

function tryJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
