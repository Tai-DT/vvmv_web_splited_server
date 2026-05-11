import { faker } from "@faker-js/faker";
import { prismaRPA } from "../lib/db";
import { OperationType, Site } from "../prisma/client";

const OPERATION_TYPES: OperationType[] = ["XUAT", "NHAP"];
const SERVICE_MODES: string[] = [
  "LCL IMPORT",
  "LCL EXPORT",
  "FCL EXPORT",
  "FCL IMPORT",
  "CPN EXPORT",
  "CPN IMPORT",
  "AIR EXPORT",
  "AIR IMPORT",
  "TC EXPORT",
  "TC IMPORT",
  "DBO EXPORT",
  "DBO IMPORT",
  "CFS DONG NAI",
  "CFS VSIP1",
  "KNQ EXPORT",
  "KNQ IMPORT",
];
const STATUSES = [
  "Pending",
  "In Progress",
  "Waiting FAST Input",
  "Completed",
  "On Hold",
  "Ready for Pickup",
];
const AUTHORITIES = [
  "Hai Quan Tan Cang",
  "Hai Quan Noi Bai",
  "Hai Quan Da Nang",
  "Hai Quan Hai Phong",
];
const WAREHOUSES = [
  "Warehouse A - HCMC",
  "Warehouse B - HCMC",
  "Warehouse C - HN",
  "Warehouse D - HN",
];
const LOCATIONS = [
  "Cat Lai Port",
  "Tan Cang Port",
  "Noi Bai Port",
  "Da Nang Port",
];
const PORTS = ["SGSIN", "VNSGN", "CNSHA", "JPYOK"];
const CARGO_TYPES = [
  "General Cargo",
  "Hazardous Materials",
  "Perishables",
  "Electronics",
  "Textiles",
  "Machinery",
];
const DOMAINS: Site[] = ["SGN", "DAD", "HAN"];
const UNITS = ["CTN", "KGS", "CBM", "PCS", "BAG"];
 
function generateFollowUpData(operationType?: OperationType) {
  const opType = operationType || faker.helpers.arrayElement(OPERATION_TYPES);
  const serviceMode = faker.helpers.arrayElement(SERVICE_MODES);

  const declarationDay = faker.number
    .int({ min: 1, max: 28 })
    .toString()
    .padStart(2, "0");
  const declarationMonth = faker.number
    .int({ min: 1, max: 12 })
    .toString()
    .padStart(2, "0");
  const declarationDate = new Date(
    `2025-${declarationMonth}-${declarationDay}`
  );

  const pickupDay = faker.number
    .int({ min: 1, max: 28 })
    .toString()
    .padStart(2, "0");
  const pickupMonth = faker.number
    .int({ min: 1, max: 12 })
    .toString()
    .padStart(2, "0");
  const pickupDate = new Date(`2025-${pickupMonth}-${pickupDay}`);

  const deliveryDay = faker.number
    .int({ min: 1, max: 28 })
    .toString()
    .padStart(2, "0");
  const deliveryMonth = faker.number
    .int({ min: 1, max: 12 })
    .toString()
    .padStart(2, "0");
  const deliveryDate = new Date(`2025-${deliveryMonth}-${deliveryDay}`);

  const startHour = faker.number.int({ min: 8, max: 12 });
  const startMinute = faker.number.int({ min: 0, max: 59 });
  const startTime = new Date(declarationDate);
  startTime.setHours(startHour, startMinute, 0);

  const endHour = faker.number.int({ min: 16, max: 18 });
  const endMinute = faker.number.int({ min: 0, max: 59 });
  const endTime = new Date(deliveryDate);
  endTime.setHours(endHour, endMinute, 0);

  const pickupHour = faker.number.int({ min: 8, max: 17 });
  const pickupMinute = faker.number.int({ min: 0, max: 59 });
  const pickupTime = '08:00';
 

  // Generate the 5 special fields
  const year = faker.helpers.arrayElement([2024, 2025]);
  const specialDeclDay = faker.number
    .int({ min: 1, max: 28 })
    .toString()
    .padStart(2, "0");
  const specialDeclMonth = faker.number
    .int({ min: 1, max: 12 })
    .toString()
    .padStart(2, "0");
  const specialDeclarationDate = new Date(
    `${year}-${specialDeclMonth}-${specialDeclDay}`
  );

  return {
    status: faker.helpers.arrayElement(STATUSES),
    botMessage: faker.lorem.sentence(),
    operationType: opType,
    serviceMode: serviceMode,
    taxCode: faker.string.numeric(10),
    companyName: faker.company.name(),
    jobNumber: `JOB-${faker.string.alphanumeric(8).toUpperCase()}`,
    driveUrl: faker.internet.url(),
    localPath: `/documents/${faker.helpers.arrayElement([2024, 2025])}/${opType.toLowerCase()}/job${faker.string.numeric(4)}`,
    notes: faker.lorem.sentence(),
    // The 5 special fields for parents
    declarationNumber: `${opType === "NHAP" ? "NK" : "XK"}/${year}/${faker.string.numeric(4)}`,
    batch: `BATCH-${faker.string.numeric(3)}`,
    authority: faker.helpers.arrayElement(AUTHORITIES),
    workType: `${opType}/Customs Clearance`,
    declarationDate: specialDeclarationDate,
    invoice: `INV-${faker.string.numeric(8)}`,
    cargoType: faker.helpers.arrayElement(CARGO_TYPES),
    billOrBooking: `BILL-${faker.string.numeric(8)}`,
    requestTruckingNo: `truck-${faker.string.numeric(8)}`,
    supplier: `SUPPLIER-${faker.string.numeric(8)}`,
    etaEtd: declarationDate,
    quantity: faker.number.int({ min: 1, max: 999 }),
    unit: faker.helpers.arrayElement(UNITS),
    grossWeight: Number.parseFloat(faker.string.numeric(4)) * 10.5,
    cbm: Number.parseFloat(faker.string.numeric(3)) * 1.5,
    containerSummary: `${faker.string.numeric(1)}x${faker.helpers.arrayElement(["20FT", "40FT"])}`,
    containerCount: faker.number.int({ min: 1, max: 9 }),
    warehouse: faker.helpers.arrayElement(WAREHOUSES),
    pod: faker.helpers.arrayElement(["VNSGN", "VNHPH", "VNDAD"]),
    pickUpTime: pickupTime,
    deliveryDate: deliveryDate,
    truckNumber: `${faker.string.numeric(2)}${faker.string.alpha(1).toUpperCase()}-${faker.string.numeric(5)}`,
    location: faker.helpers.arrayElement(LOCATIONS),
    pol: faker.helpers.arrayElement(PORTS),
    supervisionGate: `Gate ${faker.string.numeric(1)}`,
    handler: faker.person.fullName(),
    startTime: startTime,
    endTime: endTime,
    poNumber: `PO-${faker.string.numeric(8)}`,
    note2: faker.lorem.sentence(),
    note3: faker.lorem.sentence(),
    shmtDate: declarationDate,
    domain: faker.helpers.arrayElement(DOMAINS),
    arNumber: `AR-${faker.string.numeric(8)}`,
    createdBy: `mzEYhIi9CsKR25sd64uxy9kE5AeNp5cw`,
  };
}

function generateChildData(parentOperationType: OperationType, childIndex: number) {
  const year = faker.helpers.arrayElement([2024, 2025]);
  const declDay = faker.number
    .int({ min: 1, max: 28 })
    .toString()
    .padStart(2, "0");
  const declMonth = faker.number
    .int({ min: 1, max: 12 })
    .toString()
    .padStart(2, "0");
  const declarationDate = new Date(`${year}-${declMonth}-${declDay}`);

  return {
    declarationNumber: `${parentOperationType === "NHAP" ? "NK" : "XK"}/${year}/${faker.string.numeric(4)}-${childIndex + 1}`,
    batch: `BATCH-${faker.string.numeric(3)}-${childIndex + 1}`,
    authority: faker.helpers.arrayElement(AUTHORITIES),
    workType: `${parentOperationType}/Customs Clearance ${childIndex + 1}`,
    declarationDate: declarationDate,
  };
}

async function seed() {
  console.log("🌱 Starting database seed...");

  // Set seed for consistent data
  faker.seed(54321);

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  await prismaRPA.declaration.deleteMany({});
  await prismaRPA.followUp.deleteMany({});

  const totalWithDeclarations = faker.number.int({ min: 5, max: 10 });
  const totalStandalone = 30 - totalWithDeclarations;

  console.log(
    `📊 Generating ${totalWithDeclarations} records with declarations and ${totalStandalone} standalone records...`
  );

  // Create records with declarations
  for (let i = 0; i < totalWithDeclarations; i++) {
    const followUpData = generateFollowUpData();

    console.log(`📋 Creating follow-up record #${i + 1} with declarations...`);

    // Create follow-up
    const followUp = await prismaRPA.followUp.create({
      data: followUpData,
    });

    // Generate 1-5 declarations for this follow-up
    const numDeclarations = faker.number.int({ min: 1, max: 5 });
    console.log(`   └─ Creating ${numDeclarations} declarations...`);

    for (let j = 0; j < numDeclarations; j++) {
      const declarationData = generateChildData(followUpData.operationType, j);

      await prismaRPA.declaration.create({
        data: {
          followUpId: followUp.id,
          declarationNumber: declarationData.declarationNumber,
          batch: declarationData.batch,
          authority: declarationData.authority,
          workType: declarationData.workType,
          declarationDate: declarationData.declarationDate,
        },
      });
    }
  }

  // Create standalone records (without declarations)
  console.log(`📝 Creating ${totalStandalone} standalone records...`);
  for (let i = 0; i < totalStandalone; i++) {
    const standaloneData = generateFollowUpData();

    await prismaRPA.followUp.create({
      data: standaloneData,
    });
  }

  const totalFollowUps = await prismaRPA.followUp.count();
  const totalDeclarations = await prismaRPA.declaration.count();

  console.log("\n✅ Seed completed successfully!");
  console.log(`📈 Total FollowUp records: ${totalFollowUps}`);
  console.log(`📄 Total Declaration records: ${totalDeclarations}`);
}

seed()
  .catch((e) => {
    console.error("❌ Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaRPA.$disconnect();
  });
