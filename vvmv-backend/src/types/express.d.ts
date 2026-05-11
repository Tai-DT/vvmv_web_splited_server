import type { User } from "../../prisma/client";

declare global {
  namespace Express {
    interface Request {
      /** Set by SessionGuard after validating Better Auth cookie + DB session */
      sessionUser?: User;
    }
  }
}

export {};
