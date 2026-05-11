import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

export type AuthenticatedSession = Awaited<
  ReturnType<AuthSessionService["getSessionFromRequest"]>
>;

@Injectable()
export class AuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getSessionFromRequest(req: Request) {
    const token = this.getSessionToken(req);
    if (!token) return null;

    // Better Auth stores cookies as `token.signature`; the DB only has `token`.
    const cleanToken = token.split(".")[0];

    return this.prisma.session.findFirst({
      where: {
        OR: [
          { token: cleanToken },
          { token },
          { id: cleanToken },
          { id: token },
        ],
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
  }

  async requireSession(req: Request) {
    const session = await this.getSessionFromRequest(req);
    if (!session?.user) return null;
    req.sessionUser = session.user;
    return session;
  }

  getSessionToken(req: Request): string | null {
    const cookieHeader = req.headers.cookie ?? "";
    for (const name of SESSION_COOKIE_NAMES) {
      const token = parseCookie(cookieHeader, name);
      if (token) return token;
    }
    return null;
  }

  clearSessionCookies(res: Response): void {
    for (const name of SESSION_COOKIE_NAMES) {
      res.cookie(name, "", {
        httpOnly: true,
        sameSite: "lax",
        expires: new Date(0),
        path: "/",
      });
    }
  }
}

export function parseCookie(header: string, name: string): string | null {
  const parts = header.split(";").map((p) => p.trim());
  const prefix = `${name}=`;
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return part.slice(prefix.length);
      }
    }
  }
  return null;
}
