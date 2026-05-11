import { Module } from "@nestjs/common";
import { ShippingLinesController } from "./shipping-lines.controller";

@Module({
  controllers: [ShippingLinesController],
})
export class ShippingLinesModule {}
