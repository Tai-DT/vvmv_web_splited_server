import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Global filter that converts every NestJS routing 404 (i.e. paths that no
 * controller handled) into a 404 carrying the `x-backend-not-implemented: 1`
 * marker. The Next-side `tryDelegateToStandaloneApi` proxy uses this header
 * to fall through to the local Next handler instead of treating the 404 as
 * authoritative.
 *
 * Explicit `throw new NotFoundException(...)` from inside a controller is
 * passed through untouched (no marker, normal 404 body) so business "not
 * found" semantics remain visible to callers.
 */
@Catch(NotFoundException)
export class NotImplementedFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const explicitlyThrown = (exception as { cause?: unknown }).cause !== undefined
      || isUserThrown(exception);

    if (explicitlyThrown) {
      const body = exception.getResponse();
      res.status(404).json(body);
      return;
    }

    res
      .status(404)
      .setHeader("x-backend-not-implemented", "1")
      .json({
        statusCode: 404,
        error: "Not Implemented",
        message: `vvmv-backend does not implement ${req.method} ${req.originalUrl} yet`,
      });
  }
}

/**
 * Heuristic: NestJS's built-in router-not-matched 404 message starts with
 * `Cannot ` (e.g. `Cannot GET /admin/foo`). Anything else is treated as an
 * application-level NotFound.
 */
function isUserThrown(exception: NotFoundException): boolean {
  const response = exception.getResponse();
  if (typeof response === "string") {
    return !response.startsWith("Cannot ");
  }
  if (response && typeof response === "object" && "message" in response) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === "string") {
      return !message.startsWith("Cannot ");
    }
  }
  return true;
}
