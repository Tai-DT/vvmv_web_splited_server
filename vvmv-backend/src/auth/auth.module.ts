import { Global, Module } from "@nestjs/common";
import { AuthSessionService } from "./auth-session.service";
import { SessionGuard } from "./session.guard";

@Global()
@Module({
  providers: [AuthSessionService, SessionGuard],
  exports: [AuthSessionService, SessionGuard],
})
export class AuthModule {}
