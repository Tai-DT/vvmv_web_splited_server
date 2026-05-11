import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  /** Opening `http://host:port/` in a browser — JSON instead of 404 from the catch-all filter. */
  @Get()
  root() {
    return {
      service: "vvmv-backend",
      health: "/health",
      note: "Routes mirror Next `/api/*` without the `/api` prefix (see vvmv-backend README).",
    };
  }

  @Get("health")
  health() {
    return { ok: true };
  }
}
