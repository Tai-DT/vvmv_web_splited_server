import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class GoogleService {
  constructor(private readonly prisma: PrismaService) {}

  async getOAuthClientForUser(userId: string): Promise<any> {
    const account = await this.prisma.account.findFirst({
      where: {
        userId,
        providerId: { in: ["google", "gmail"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!account?.accessToken) {
      throw new Error("Google access token is not available for this user");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken ?? undefined,
      expiry_date: account.accessTokenExpiresAt?.getTime(),
      scope: account.scope ?? undefined,
    });
    return oauth2Client;
  }

  getServiceAccountClient(scopes: string[]): any {
    const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
    const credentials = rawJson
      ? JSON.parse(rawJson)
      : {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: (
            process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ??
            process.env.GOOGLE_PRIVATE_KEY
          )?.replace(/\\n/g, "\n"),
        };

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error("Google service-account credentials are not configured");
    }

    return new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes,
      subject: process.env.GOOGLE_WORKSPACE_IMPERSONATE_USER || undefined,
    });
  }

  /** True when Better Auth has stored a Google/Gmail OAuth token for this user. */
  private async hasGoogleOAuthAccess(userId: string): Promise<boolean> {
    const account = await this.prisma.account.findFirst({
      where: {
        userId,
        providerId: { in: ["google", "gmail"] },
      },
      orderBy: { updatedAt: "desc" },
    });
    return Boolean(account?.accessToken);
  }

  /**
   * List Drive files: user OAuth when linked, otherwise service account (same as Next `getDriveClient`).
   */
  async listDriveFilesWithFallback(
    userId: string,
    query?: string,
    pageToken?: string,
  ) {
    const oauthAvailable = await this.hasGoogleOAuthAccess(userId);
    if (oauthAvailable) {
      try {
        return await this.listDriveFiles(userId, query, pageToken);
      } catch (err) {
        console.warn(
          "Drive list via user OAuth failed, falling back to service account:",
          err instanceof Error ? err.message : err,
        );
      }
    }
    return this.listDriveFilesAsServiceAccount(query, pageToken);
  }

  async listDriveFilesAsServiceAccount(query?: string, pageToken?: string) {
    const auth = this.getServiceAccountClient([
      "https://www.googleapis.com/auth/drive",
    ]);
    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.list({
      q: query,
      pageToken,
      fields:
        "nextPageToken, files(id, name, mimeType, parents, webViewLink, webContentLink, thumbnailLink, createdTime, modifiedTime, size)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return response.data;
  }

  async listGmailMessages(
    userId: string,
    query: string | undefined,
    maxResults = 20,
  ) {
    const auth = await this.getOAuthClientForUser(userId);
    const gmail = google.gmail({ version: "v1", auth });
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });
    return response.data;
  }

  async getGmailThread(userId: string, threadId: string) {
    const auth = await this.getOAuthClientForUser(userId);
    const gmail = google.gmail({ version: "v1", auth });
    const response = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
    });
    return response.data;
  }

  async getGmailAttachment(
    userId: string,
    messageId: string,
    attachmentId: string,
  ) {
    const auth = await this.getOAuthClientForUser(userId);
    const gmail = google.gmail({ version: "v1", auth });
    const response = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });
    return response.data;
  }

  async sendContactEmail(input: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    const auth = this.getServiceAccountClient([
      "https://www.googleapis.com/auth/gmail.send",
    ]);
    const gmail = google.gmail({ version: "v1", auth });
    const to = process.env.CONTACT_EMAIL_TO || process.env.GMAIL_SEND_TO;
    const from =
      process.env.CONTACT_EMAIL_FROM ||
      process.env.GOOGLE_WORKSPACE_IMPERSONATE_USER ||
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (!to || !from) {
      throw new Error("Contact mail sender/recipient is not configured");
    }

    const raw = [
      `From: ${from}`,
      `To: ${to}`,
      `Reply-To: ${input.email}`,
      `Subject: ${input.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      "",
      input.message,
    ].join("\r\n");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: Buffer.from(raw).toString("base64url"),
      },
    });
    return response.data;
  }

  async drive(userId: string) {
    const auth = await this.getOAuthClientForUser(userId);
    return google.drive({ version: "v3", auth });
  }

  async listDriveFiles(userId: string, query?: string, pageToken?: string) {
    const drive = await this.drive(userId);
    const response = await drive.files.list({
      q: query,
      pageToken,
      fields:
        "nextPageToken, files(id, name, mimeType, parents, webViewLink, webContentLink, thumbnailLink, createdTime, modifiedTime, size)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return response.data;
  }

  async downloadDriveFile(userId: string, fileId: string) {
    const drive = await this.drive(userId);
    const [metadata, media] = await Promise.all([
      drive.files.get({
        fileId,
        fields: "id,name,mimeType",
        supportsAllDrives: true,
      }),
      drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" },
      ),
    ]);
    return {
      metadata: metadata.data,
      buffer: Buffer.from(media.data as ArrayBuffer),
    };
  }

  async getDriveThumbnail(userId: string, fileId: string) {
    const drive = await this.drive(userId);
    const response = await drive.files.get({
      fileId,
      fields: "thumbnailLink, iconLink, name, mimeType",
      supportsAllDrives: true,
    });
    return response.data;
  }

  async renameDriveFile(userId: string, fileId: string, name: string) {
    const drive = await this.drive(userId);
    const response = await drive.files.update({
      fileId,
      requestBody: { name },
      fields: "id,name,mimeType,webViewLink",
      supportsAllDrives: true,
    });
    return response.data;
  }

  async createFolder(userId: string, name: string, parentId?: string) {
    const drive = await this.drive(userId);
    const response = await drive.files.create({
      requestBody: {
        name,
        parents: parentId ? [parentId] : undefined,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id,name,mimeType,webViewLink",
      supportsAllDrives: true,
    });
    return response.data;
  }

  async uploadBuffer(
    userId: string,
    input: {
      name: string;
      mimeType?: string;
      parentId?: string;
      buffer: Buffer;
    },
  ) {
    const drive = await this.drive(userId);
    const response = await drive.files.create({
      requestBody: {
        name: input.name,
        parents: input.parentId ? [input.parentId] : undefined,
      },
      media: {
        mimeType: input.mimeType || "application/octet-stream",
        body: bufferToStream(input.buffer),
      },
      fields: "id,name,mimeType,webViewLink,webContentLink",
      supportsAllDrives: true,
    });
    return response.data;
  }
}

function bufferToStream(buffer: Buffer) {
  const { Readable } = require("stream") as typeof import("stream");
  return Readable.from(buffer);
}
