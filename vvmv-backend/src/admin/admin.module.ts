import { Module } from "@nestjs/common";
import { AdminCompanyColorsController } from "./admin-company-colors.controller";
import { AdminCustomsWarehousesController } from "./admin-customs-warehouses.controller";
import { AdminDepartmentManagersController } from "./admin-department-managers.controller";
import {
  AdminDepartmentsBySiteController,
  AdminDepartmentsController,
} from "./admin-departments.controller";
import {
  AdminFieldOptionByIdController,
  AdminFieldOptionsController,
} from "./admin-field-options.controller";
import { AdminForeignPortsController } from "./admin-foreign-ports.controller";
import { AdminOpsController } from "./admin-ops.controller";
import { AdminPickOrLiftPlacesController } from "./admin-pick-or-lift-places.controller";
import { AdminShippingLinesController } from "./admin-shipping-lines.controller";
import { AdminSiteManagersController } from "./admin-site-managers.controller";
import { AdminTeamsController } from "./admin-teams.controller";
import { AdminVendorsController } from "./admin-vendors.controller";

@Module({
  controllers: [
    AdminShippingLinesController,
    AdminForeignPortsController,
    AdminOpsController,
    AdminVendorsController,
    AdminPickOrLiftPlacesController,
    AdminCustomsWarehousesController,
    AdminTeamsController,
    AdminDepartmentsController,
    AdminDepartmentsBySiteController,
    AdminSiteManagersController,
    AdminDepartmentManagersController,
    AdminCompanyColorsController,
    AdminFieldOptionsController,
    AdminFieldOptionByIdController,
  ],
})
export class AdminModule {}
