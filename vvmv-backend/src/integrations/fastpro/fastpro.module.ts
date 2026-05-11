import { Global, Module } from "@nestjs/common";
import { FastproService } from "./fastpro.service";

@Global()
@Module({
  providers: [FastproService],
  exports: [FastproService],
})
export class FastproModule {}
