import { All, Controller, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { FRONTEND_API_NEST_PATHS } from "./api-route-registry";
import { CompatApiService } from "./compat-api.service";

@Controller()
export class CompatApiController {
  constructor(private readonly compat: CompatApiService) {}

  @All(FRONTEND_API_NEST_PATHS as string[])
  async handle(@Req() req: Request, @Res() res: Response) {
    const result = await this.compat.handle(req, res);
    if (res.headersSent) return;

    for (const [name, value] of Object.entries(result.headers ?? {})) {
      res.setHeader(name, value);
    }

    if (result.raw !== undefined) {
      if (result.contentType) res.type(result.contentType);
      res.status(result.status ?? 200).send(result.raw);
      return;
    }

    res.status(result.status ?? 200).json(result.body ?? null);
  }
}
