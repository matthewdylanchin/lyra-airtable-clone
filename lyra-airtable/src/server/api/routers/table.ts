import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { faker } from "@faker-js/faker";
import { TRPCError } from "@trpc/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

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
              type: z.enum(["text", "number"]).optional(),
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

      // ========== FILTERING LOGIC (unchanged) ==========
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

      // ========== ✅ FIXED SORTING LOGIC ==========
      // Build the WHERE clause for rows
      const rowWhere: NonNullable<
        Parameters<typeof ctx.db.row.findMany>[0]
      >["where"] = {
        tableId: table.id,
      };

      // Apply filtering if present
      if (filteredRowIds) {
        rowWhere.id = { in: filteredRowIds };
      } else if (cursor !== undefined) {
        rowWhere.rowIndex = { gt: cursor };
      }

      // ✅ NEW: Build Prisma orderBy for sorting
      let orderBy: NonNullable<
        Parameters<typeof ctx.db.row.findMany>[0]
      >["orderBy"] = { rowIndex: "asc" };

      const firstSort = sorts?.[0];
      if (firstSort) {
        const column = columns.find((c) => c.id === firstSort.columnId);

        if (!column) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sort column not found",
          });
        }

        // ✅ Use Prisma's relation sorting via cells
        // This tells Prisma: "JOIN to cells table and order by the cell value"
        orderBy = {
          cells: {
            _count: column.type === "NUMBER" ? undefined : "desc",
          },
        };

        // Note: Prisma doesn't support direct relation sorting with WHERE clause on the relation
        // So we need a different approach for large datasets
      }

      // ✅ WORKAROUND: For sorting, we'll use a subquery approach
      let rows;
      let totalCount;

      if (firstSort) {
        const column = columns.find((c) => c.id === firstSort.columnId);
        if (!column) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sort column not found",
          });
        }

        // Get sorted cell data first
        const sortedCells = await ctx.db.cell.findMany({
          where: {
            columnId: firstSort.columnId,
            row: rowWhere,
          },
          select: {
            rowId: true,
            textValue: true,
            numberValue: true,
          },
          orderBy:
            column.type === "NUMBER"
              ? { numberValue: firstSort.direction }
              : { textValue: firstSort.direction },
        });

        const sortedRowIds = sortedCells.map((c) => c.rowId);

        // Fetch rows in sorted order with pagination
        const rowsToFetch = sortedRowIds.slice(0, limit + 1);

        [rows, totalCount] = await Promise.all([
          ctx.db.row.findMany({
            where: {
              id: { in: rowsToFetch },
            },
            select: { id: true, rowIndex: true },
          }),
          ctx.db.row.count({
            where: rowWhere,
          }),
        ]);

        // Maintain sort order
        const rowMap = new Map(rows.map((r) => [r.id, r]));
        rows = rowsToFetch
          .map((id) => rowMap.get(id))
          .filter((r): r is NonNullable<typeof r> => r !== undefined);
      } else {
        // No sorting - use default pagination
        [rows, totalCount] = await Promise.all([
          ctx.db.row.findMany({
            where: rowWhere,
            orderBy: { rowIndex: "asc" },
            take: limit + 1,
            select: { id: true, rowIndex: true },
          }),
          ctx.db.row.count({
            where: rowWhere,
          }),
        ]);
      }

      const hasMore = rows.length > limit;
      const resultRows = hasMore ? rows.slice(0, limit) : rows;

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
