import { Module } from "@nestjs/common";
import { ContainerSizeConfigsController } from "./container-size-configs.controller";
import { FieldOptionsController } from "./field-options.controller";
import { FieldOptionsService } from "./field-options.service";
import { ForeignPortsController } from "./foreign-ports.controller";
import { OpsController } from "./ops.controller";
import { PickOrLiftPlaceController } from "./pick-or-lift-place.controller";
import { TablePreferencesController } from "./table-preferences.controller";
import { TrackingController } from "./tracking.controller";
import { UserDepartmentsController } from "./user-departments.controller";
import { UserTeamsController } from "./user-teams.controller";
import { UsersBySiteController } from "./users-by-site.controller";
import { VendorFeeTypesController } from "./vendor-fee-types.controller";
import { VendorsController } from "./vendors.controller";

@Module({
  controllers: [
    ContainerSizeConfigsController,
    FieldOptionsController,
    ForeignPortsController,
    OpsController,
    PickOrLiftPlaceController,
    TablePreferencesController,
    TrackingController,
    UserDepartmentsController,
    UserTeamsController,
    UsersBySiteController,
    VendorFeeTypesController,
    VendorsController,
  ],
  providers: [FieldOptionsService],
})
export class ReferenceDataModule {}
