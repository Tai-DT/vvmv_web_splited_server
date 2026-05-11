#!/usr/bin/env node
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../prisma/client/index.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function cleanText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeComparable(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTaxComparable(value) {
  return String(value ?? "").replace(/\D+/g, "");
}

const ADDRESS_LABEL_PATTERN = /^(?:dia\s*chi|địa\s*chỉ|address|addr)\s*[:：-]\s*(.+)$/i;
const COMPANY_NAME_LABEL_PATTERN = /^(?:ten\s*(?:cong\s*ty|cty|don\s*vi)|tên\s*(?:công\s*ty|cty|đơn\s*vị)|company(?:\s*name)?|name)\s*[:：-]\s*(.+)$/i;
const PHONE_LABEL_PATTERN = /^(?:dien\s*thoai|điện\s*thoại|phone|tel|telephone|sdt|sđt|so\s*dien\s*thoai|số\s*điện\s*thoại)\s*[:：-]\s*(.+)$/i;
const POSTAL_CODE_LABEL_PATTERN = /^(?:ma\s*buu\s*chinh|mã\s*bưu\s*chính|postal(?:\s*code)?|zip(?:\s*code)?|postcode)\s*[:：-]\s*(.+)$/i;
const TAX_CODE_LABEL_PATTERN = /^(?:mst|ma\s*so\s*thue|mã\s*số\s*thuế|tax\s*(?:code|id|number)?|taxcode)\s*[:：-]?\s*(.+)$/i;

function invoiceLines(invoiceData) {
  return String(invoiceData ?? "")
    .split(/\r?\n|;/)
    .map(cleanText)
    .filter(Boolean);
}

function labeledValue(lines, pattern) {
  for (const line of lines) {
    const value = cleanText(line.match(pattern)?.[1]);
    if (value) return value;
  }
  return null;
}

function isTaxLine(line, taxCode) {
  if (TAX_CODE_LABEL_PATTERN.test(line)) return true;
  const tax = normalizeTaxComparable(taxCode);
  return Boolean(tax) && normalizeTaxComparable(line).includes(tax);
}

function parseInvoiceProfile({ invoiceData, companyName, taxCode }) {
  const lines = invoiceLines(invoiceData);
  const invoiceCompanyName = labeledValue(lines, COMPANY_NAME_LABEL_PATTERN);
  const resolvedCompanyName = cleanText(companyName) ?? invoiceCompanyName;
  const labeledAddress = labeledValue(lines, ADDRESS_LABEL_PATTERN);
  const normalizedCompanyName = normalizeComparable(resolvedCompanyName);
  const invoiceAddress = labeledAddress ?? cleanText(lines.filter((line) => {
    if (isTaxLine(line, taxCode)) return false;
    if (normalizedCompanyName && normalizeComparable(line) === normalizedCompanyName) return false;
    return !COMPANY_NAME_LABEL_PATTERN.test(line) && !ADDRESS_LABEL_PATTERN.test(line);
  }).join(", "));
  const rawPhone = labeledValue(lines, PHONE_LABEL_PATTERN);
  const digits = rawPhone ? rawPhone.replace(/\D+/g, "") : null;
  return {
    invoiceCompanyName,
    invoiceAddress,
    invoicePostalCode: labeledValue(lines, POSTAL_CODE_LABEL_PATTERN),
    invoicePhone: digits || rawPhone,
  };
}

async function main() {
  const partners = await prisma.partnersMasterData.findMany({
    select: {
      id: true,
      taxCode: true,
      fullName: true,
      invoiceData: true,
      invoiceCompanyName: true,
      invoiceAddress: true,
      invoicePostalCode: true,
      invoicePhone: true,
    },
  });

  let updated = 0;
  for (const partner of partners) {
    const parsed = parseInvoiceProfile({
      invoiceData: partner.invoiceData,
      companyName: partner.fullName,
      taxCode: partner.taxCode,
    });
    const data = {};
    for (const key of Object.keys(parsed)) {
      if (!partner[key] && parsed[key]) data[key] = parsed[key];
    }
    if (Object.keys(data).length === 0) continue;
    await prisma.partnersMasterData.update({ where: { id: partner.id }, data });
    updated += 1;
  }

  console.log(JSON.stringify({ scanned: partners.length, updated }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
