import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { CompatApiModule } from "./compat/compat-api.module";
import { FastproModule } from "./integrations/fastpro/fastpro.module";
import { GeminiModule } from "./integrations/gemini/gemini.module";
import { GoogleModule } from "./integrations/google/google.module";
import { MssqlModule } from "./integrations/mssql/mssql.module";
import { SnpModule } from "./integrations/snp/snp.module";
import { NotImplementedFilter } from "./not-implemented.filter";
import { PrismaModule } from "./prisma/prisma.module";
import { ReferenceDataModule } from "./reference-data/reference-data.module";
import { ShippingLinesModule } from "./shipping-lines/shipping-lines.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MssqlModule,
    GoogleModule,
    GeminiModule,
    FastproModule,
    SnpModule,
    ShippingLinesModule,
    ReferenceDataModule,
    AdminModule,
    CompatApiModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: NotImplementedFilter,
    },
  ],
})
export class AppModule {}
