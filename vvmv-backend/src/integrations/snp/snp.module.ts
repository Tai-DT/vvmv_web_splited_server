import { Global, Module } from "@nestjs/common";
import { SnpService } from "./snp.service";

@Global()
@Module({
  providers: [SnpService],
  exports: [SnpService],
})
export class SnpModule {}
