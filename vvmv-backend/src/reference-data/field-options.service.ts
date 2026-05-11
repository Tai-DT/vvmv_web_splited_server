import { Injectable } from "@nestjs/common";
import type { Site } from "../../prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type FieldOptionConditionPrimitive = string | number | boolean;

type FieldOptionOperatorObject = {
  $eq?: FieldOptionConditionPrimitive;
  $not?: FieldOptionConditionPrimitive;
  $in?: FieldOptionConditionPrimitive[];
  $nin?: FieldOptionConditionPrimitive[];
  $like?: string;
  $startsWith?: string;
  $endsWith?: string;
};

type FieldOptionConditionValue =
  | FieldOptionConditionPrimitive
  | FieldOptionConditionPrimitive[]
  | FieldOptionOperatorObject;

type FieldOptionConditions = {
  $or?: FieldOptionConditions[];
  $and?: FieldOptionConditions[];
  [field: string]:
    | FieldOptionConditionValue
    | FieldOptionConditions[]
    | undefined;
};

@Injectable()
export class FieldOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  matchesSingleValue(
    actualValue: unknown,
    expectedValue: FieldOptionConditionValue,
  ): boolean {
    if (actualValue === undefined || actualValue === null) return false;

    if (
      typeof expectedValue === "object" &&
      !Array.isArray(expectedValue) &&
      expectedValue !== null
    ) {
      const op = expectedValue as FieldOptionOperatorObject;
      const actual = String(actualValue).toLowerCase();

      if (op.$eq !== undefined && String(op.$eq).toLowerCase() !== actual)
        return false;
      if (op.$not !== undefined && String(op.$not).toLowerCase() === actual)
        return false;
      if (
        op.$in !== undefined &&
        !op.$in.some((v) => String(v).toLowerCase() === actual)
      )
        return false;
      if (
        op.$nin !== undefined &&
        op.$nin.some((v) => String(v).toLowerCase() === actual)
      )
        return false;
      if (op.$like !== undefined && !actual.includes(op.$like.toLowerCase()))
        return false;
      if (
        op.$startsWith !== undefined &&
        !actual.startsWith(op.$startsWith.toLowerCase())
      )
        return false;
      if (
        op.$endsWith !== undefined &&
        !actual.endsWith(op.$endsWith.toLowerCase())
      )
        return false;

      return true;
    }

    if (Array.isArray(expectedValue)) {
      const expectedStrs = expectedValue.map((v) => String(v).toLowerCase());
      if (Array.isArray(actualValue)) {
        return (actualValue as unknown[]).some((v) =>
          expectedStrs.includes(String(v).toLowerCase()),
        );
      }
      return expectedStrs.includes(String(actualValue).toLowerCase());
    }

    if (Array.isArray(actualValue)) {
      return (actualValue as unknown[]).some(
        (v) =>
          String(v).toLowerCase() === String(expectedValue).toLowerCase(),
      );
    }
    return (
      String(actualValue).toLowerCase() === String(expectedValue).toLowerCase()
    );
  }

  matchesConditions(
    optionConditions: unknown,
    context: Record<string, unknown>,
  ): boolean {
    if (!optionConditions || typeof optionConditions !== "object") return true;

    const cond = optionConditions as FieldOptionConditions;

    if (Array.isArray(cond.$or)) {
      if (!cond.$or.some((branch) => this.matchesConditions(branch, context)))
        return false;
    }

    if (Array.isArray(cond.$and)) {
      if (!cond.$and.every((branch) => this.matchesConditions(branch, context)))
        return false;
    }

    const fieldEntries = Object.entries(cond).filter(
      ([k]) => k !== "$or" && k !== "$and",
    );

    if (fieldEntries.length === 0 && !cond.$or && !cond.$and) return true;

    return fieldEntries.every(([field, expectedValue]) =>
      this.matchesSingleValue(
        context[field],
        expectedValue as FieldOptionConditionValue,
      ),
    );
  }

  async listFiltered(params: {
    fieldName: string;
    effectiveSite: Site;
    context: Record<string, unknown>;
  }) {
    const rawItems = await this.prisma.fieldOption.findMany({
      where: {
        fieldName: params.fieldName,
        isActive: true,
        OR: [{ site: null }, { site: params.effectiveSite }],
      },
      orderBy: [{ order: "asc" }, { code: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        color: true,
        conditions: true,
        order: true,
        site: true,
      },
    });

    return rawItems.filter((item) =>
      this.matchesConditions(item.conditions, params.context),
    );
  }
}
