import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { faker } from "@faker-js/faker";
import { TRPCError } from "@trpc/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";

export const tableRouter = createTRPCRouter({
  listByBase: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) throw new Error("UNAUTHORIZED");

      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        name: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });

      if (!base) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      try {
        const result = await ctx.db.$transaction(async (tx) => {
          const table = await tx.table.create({
            data: {
              baseId: input.baseId,
              name: input.name,
            },
            select: {
              id: true,
              name: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          await tx.column.createMany({
            data: [
              { tableId: table.id, name: "Name", type: "TEXT", order: 0 },
              { tableId: table.id, name: "Notes", type: "TEXT", order: 1 },
              { tableId: table.id, name: "Assignee", type: "TEXT", order: 2 },
              { tableId: table.id, name: "Status", type: "TEXT", order: 3 },
              { tableId: table.id, name: "Attachment", type: "TEXT", order: 4 },
              {
                tableId: table.id,
                name: "Attachment Summary",
                type: "TEXT",
                order: 5,
              },
            ],
          });

          const columns = await tx.column.findMany({
            where: { tableId: table.id },
            orderBy: { order: "asc" },
            select: { id: true, name: true },
          });

          const rows = await Promise.all(
            Array.from({ length: 20 }).map((_, i) =>
              tx.row.create({
                data: {
                  tableId: table.id,
                  rowIndex: i,
                },
                select: { id: true },
              }),
            ),
          );

          await tx.cell.createMany({
            data: rows.flatMap((r) =>
              columns.map((c) => {
                switch (c.name) {
                  case "Name":
                    return {
                      rowId: r.id,
                      columnId: c.id,
                      textValue: faker.person.fullName(),
                    };

                  case "Notes":
                    return {
                      rowId: r.id,
                      columnId: c.id,
                      textValue: faker.lorem.sentence(),
                    };

                  case "Assignee":
                    return {
                      rowId: r.id,
                      columnId: c.id,
                      textValue: faker.person.firstName(),
                    };

                  case "Status":
                    return {
                      rowId: r.id,
                      columnId: c.id,
                      textValue: faker.helpers.arrayElement([
                        "Todo",
                        "In Progress",
                        "Done",
                      ]),
                    };

                  case "Attachment":
                    return {
                      rowId: r.id,
                      columnId: c.id,
                      textValue: faker.system.fileName(),
                    };

                  case "Attachment Summary":
                    return {
                      rowId: r.id,
                      columnId: c.id,
                      textValue: faker.lorem.words(3),
                    };

                  default:
                    return {
                      rowId: r.id,
                      columnId: c.id,
                      textValue: null,
                    };
                }
              }),
            ),
          });

          return table;
        });

        return result;
      } catch (err: unknown) {
        if (
          err instanceof PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Please enter a unique table name",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create table",
        });
      }
    }),

  getData: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        limit: z.number().int().min(1).max(10000).default(5000),
        cursor: z.number().int().optional(),
        searchQuery: z.string().optional(),
        filterConjunction: z.enum(["and", "or"]).optional(),
        filters: z
          .array(
            z.object({
              columnId: z.string(),
              operator: z.string(),
              value: z.string(),
            }),
          )
          .optional(),
        sorts: z
          .array(
            z.object({
              columnId: z.string(),
              type: z.enum(["text", "number"]).optional(), // ✅ Made optional - we'll ignore it
              direction: z.enum(["asc", "desc"]),
            }),
          )
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { tableId, limit, cursor, filters, sorts } = input;

      const table = await ctx.db.table.findFirst({
        where: {
          id: tableId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true, name: true, baseId: true },
      });

      if (!table) throw new Error("UNAUTHORIZED");

      const columns = await ctx.db.column.findMany({
        where: { tableId: table.id },
        orderBy: { order: "asc" },
        select: { id: true, name: true, type: true, order: true },
      });

      let filteredRowIds: string[] | null = null;

      // Filtering logic
      if (filters?.length) {
        const cellFilterPromises = filters.map(async (filter) => {
          const base: Record<string, unknown> = {
            columnId: filter.columnId,
          };

          const column = columns.find((c) => c.id === filter.columnId);
          const isNumberColumn = column?.type === "NUMBER";

          if (isNumberColumn) {
            const val = Number(filter.value);
            switch (filter.operator) {
              case "equals":
                Object.assign(base, { numberValue: { equals: val } });
                break;

              case "not_equals":
                Object.assign(base, { numberValue: { not: { equals: val } } });
                break;

              case "gt":
                Object.assign(base, { numberValue: { gt: val } });
                break;

              case "gte":
                Object.assign(base, { numberValue: { gte: val } });
                break;

              case "lt":
                Object.assign(base, { numberValue: { lt: val } });
                break;

              case "lte":
                Object.assign(base, { numberValue: { lte: val } });
                break;

              case "empty":
                Object.assign(base, { numberValue: null });
                break;

              case "not_empty":
                Object.assign(base, { numberValue: { not: null } });
                break;
            }
          } else {
            switch (filter.operator) {
              case "contains":
                Object.assign(base, {
                  textValue: {
                    contains: filter.value,
                    mode: "insensitive",
                  },
                });
                break;

              case "not_contains":
                Object.assign(base, {
                  NOT: {
                    textValue: {
                      contains: filter.value,
                      mode: "insensitive",
                    },
                  },
                });
                break;

              case "equals":
                Object.assign(base, {
                  textValue: {
                    equals: filter.value,
                    mode: "insensitive",
                  },
                });
                break;

              case "not_equals":
                Object.assign(base, {
                  NOT: {
                    textValue: {
                      equals: filter.value,
                      mode: "insensitive",
                    },
                  },
                });
                break;

              case "empty":
                Object.assign(base, {
                  OR: [{ textValue: null }, { textValue: "" }],
                });
                break;

              case "not_empty":
                Object.assign(base, {
                  AND: [
                    { textValue: { not: null } },
                    { textValue: { not: "" } },
                  ],
                });
                break;
            }
          }

          const matchingCells = await ctx.db.cell.findMany({
            where: base,
            select: { rowId: true },
            distinct: ["rowId"],
          });

          return new Set(matchingCells.map((c) => c.rowId));
        });

        const rowIdSets = await Promise.all(cellFilterPromises);

        if (rowIdSets.length > 0) {
          if (input.filterConjunction === "or") {
            const allRowIds = new Set<string>();
            rowIdSets.forEach((set) => {
              set.forEach((id) => allRowIds.add(id));
            });
            filteredRowIds = Array.from(allRowIds);
          } else {
            filteredRowIds = Array.from(rowIdSets[0]!);
            for (let i = 1; i < rowIdSets.length; i++) {
              filteredRowIds = filteredRowIds.filter((id) =>
                rowIdSets[i]!.has(id),
              );
            }
          }
        }
      }

      let sortedRowIds: string[] | null = null;

      // ✅ FIXED: Sorting logic with auto-detection
      const firstSort = sorts?.[0];

      if (firstSort) {
        // Find the column to determine its actual type
        const column = columns.find((c) => c.id === firstSort.columnId);

        if (!column) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sort column not found",
          });
        }

        const orderBy: Record<string, "asc" | "desc"> = {};

        // Use the ACTUAL column type from database
        if (column.type === "NUMBER") {
          orderBy.numberValue = firstSort.direction;
        } else {
          orderBy.textValue = firstSort.direction;
        }

        const sortedCells = (await ctx.db.cell.findMany({
          where: {
            columnId: firstSort.columnId,
            ...(filteredRowIds ? { rowId: { in: filteredRowIds } } : {}),
          },
          select: {
            rowId: true,
            textValue: true,
            numberValue: true,
          },
        })) as Array<{
          rowId: string;
          textValue: string | null;
          numberValue: number | null;
        }>;

        // ✅ Sort in memory with case-insensitive comparison
        sortedCells.sort((a, b) => {
          if (column.type === "NUMBER") {
            const aVal = a.numberValue ?? -Infinity;
            const bVal = b.numberValue ?? -Infinity;
            return firstSort.direction === "asc" ? aVal - bVal : bVal - aVal;
          } else {
            // ✅ Case-insensitive text comparison
            const aVal = (a.textValue ?? "").toLowerCase();
            const bVal = (b.textValue ?? "").toLowerCase();

            if (firstSort.direction === "asc") {
              return aVal.localeCompare(bVal);
            } else {
              return bVal.localeCompare(aVal);
            }
          }
        });

        sortedRowIds = sortedCells.map((c) => c.rowId);
      }

      // Build final rowWhere condition
      const rowWhere: NonNullable<
        Parameters<typeof ctx.db.row.findMany>[0]
      >["where"] = {
        tableId: table.id,
      };
      if (sortedRowIds) {
        // ✅ When sorting, use sorted order
        rowWhere.id = { in: sortedRowIds };
      } else if (filteredRowIds) {
        // ✅ When filtering only, use filtered rows
        rowWhere.id = { in: filteredRowIds };
      } else if (cursor !== undefined) {
        // ✅ Default pagination
        rowWhere.rowIndex = { gt: cursor };
      }

      const [rows, totalCount] = await Promise.all([
        ctx.db.row.findMany({
          where: rowWhere,
          orderBy: sortedRowIds
            ? undefined // Already sorted via sortedRowIds order
            : { rowIndex: "asc" }, // Default sort
          take: limit + 1,
          select: { id: true, rowIndex: true },
        }),
        ctx.db.row.count({
          where: {
            tableId: table.id,
            ...(filteredRowIds ? { id: { in: filteredRowIds } } : {}),
          },
        }),
      ]);

      // ✅ If we have sortedRowIds, we need to maintain that order
      let orderedRows = rows;
      if (sortedRowIds) {
        const rowMap = new Map(rows.map((r) => [r.id, r]));
        orderedRows = sortedRowIds
          .map((id) => rowMap.get(id))
          .filter((r): r is NonNullable<typeof r> => r !== undefined);
      }

      const hasMore = orderedRows.length > limit;
      const resultRows = hasMore ? orderedRows.slice(0, limit) : orderedRows;

      const nextCursor = hasMore
        ? resultRows[resultRows.length - 1]?.rowIndex
        : undefined;

      const rowIds = resultRows.map((r) => r.id);

      const cells = rowIds.length
        ? await ctx.db.cell.findMany({
            where: { rowId: { in: rowIds } },
            select: {
              id: true,
              rowId: true,
              columnId: true,
              textValue: true,
              numberValue: true,
              updatedAt: true,
            },
          })
        : [];

      return {
        table,
        columns,
        rows: resultRows,
        cells,
        totalCount,
        nextCursor,
      };
    }),
});
