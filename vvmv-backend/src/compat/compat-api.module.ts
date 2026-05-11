import { Module } from "@nestjs/common";
import { CompatApiController } from "./compat-api.controller";
import { CompatApiService } from "./compat-api.service";

@Module({
  controllers: [CompatApiController],
  providers: [CompatApiService],
})
export class CompatApiModule {}
