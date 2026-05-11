import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthSessionService } from "./auth-session.service";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authSession: AuthSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const session = await this.authSession.requireSession(req);

    if (!session?.user) {
      throw new UnauthorizedException({ message: "Unauthorized" });
    }

    return true;
  }
}
