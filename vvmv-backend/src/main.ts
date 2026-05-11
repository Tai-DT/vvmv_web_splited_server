import "reflect-metadata";
import { config } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(",").map((s) => s.trim())
      : true,
    credentials: true,
  });

  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen(port, host);
  console.log(`vvmv-backend (NestJS) listening on http://${host}:${port}`);
  if (host === "0.0.0.0") {
    console.log(
      `  → From this machine, Next.js BACKEND_URL should be http://127.0.0.1:${port} (or http://localhost:${port})`,
    );
  }
}

bootstrap();
