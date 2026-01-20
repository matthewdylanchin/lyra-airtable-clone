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

          /** Fetch columns back so we have IDs */
          const columns = await tx.column.findMany({
            where: { tableId: table.id },
            orderBy: { order: "asc" },
            select: { id: true, name: true },
          });

          /** Create default rows */
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

          /** Seed default cells for all columns */
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
        // ✅ Remove 'type' requirement - backend will determine it
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
              type: z.enum(["text", "number"]),
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

      // ✅ Enhanced filtering - determine type from columns
      if (filters?.length) {
        const cellFilterPromises = filters.map(async (filter) => {
          const base: any = { columnId: filter.columnId };

          // ✅ Find the column to determine type
          const column = columns.find((c) => c.id === filter.columnId);
          const isNumberColumn = column?.type === "NUMBER";

          if (isNumberColumn) {
            const val = Number(filter.value);

            switch (filter.operator) {
              case "equals":
                base.numberValue = { equals: val };
                break;
              case "not_equals":
                base.numberValue = { not: { equals: val } };
                break;
              case "gt":
                base.numberValue = { gt: val };
                break;
              case "gte":
                base.numberValue = { gte: val };
                break;
              case "lt":
                base.numberValue = { lt: val };
                break;
              case "lte":
                base.numberValue = { lte: val };
                break;
              case "empty":
                base.numberValue = null;
                break;
              case "not_empty":
                base.numberValue = { not: null };
                break;
            }
          } else {
            // Text column
            switch (filter.operator) {
              case "contains":
                base.textValue = {
                  contains: filter.value,
                  mode: "insensitive",
                };
                break;
              case "not_contains":
                base.textValue = {
                  not: { contains: filter.value, mode: "insensitive" },
                };
                break;
              case "equals":
                base.textValue = { equals: filter.value, mode: "insensitive" };
                break;
              case "not_equals":
                base.textValue = {
                  not: { equals: filter.value, mode: "insensitive" },
                };
                break;
              case "empty":
                base.OR = [{ textValue: null }, { textValue: "" }];
                break;
              case "not_empty":
                base.AND = [
                  { textValue: { not: null } },
                  { textValue: { not: "" } },
                ];
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
          filteredRowIds = Array.from(rowIdSets[0]!);

          for (let i = 1; i < rowIdSets.length; i++) {
            const currentSet = rowIdSets[i]!;
            filteredRowIds = filteredRowIds.filter((id) => currentSet.has(id));
          }
        }
      }

      let sortedRowIds: string[] | null = null;

      // Sorting logic
      const firstSort = sorts?.[0];

      if (firstSort) {
        const orderBy: any = {};

        if (firstSort.type === "text") {
          orderBy.textValue = firstSort.direction;
        } else if (firstSort.type === "number") {
          orderBy.numberValue = firstSort.direction;
        }

        const sortedCells = await ctx.db.cell.findMany({
          where: {
            columnId: firstSort.columnId,
            ...(filteredRowIds ? { rowId: { in: filteredRowIds } } : {}),
          },
          orderBy,
          select: { rowId: true },
          take: limit + 1,
          skip: cursor ? 1 : 0,
        });

        sortedRowIds = sortedCells.map((c) => c.rowId);
      }

      // Build final rowWhere condition
      const rowWhere: any = { tableId: table.id };

      if (cursor !== undefined) {
        rowWhere.rowIndex = { gt: cursor };
      }

      if (filteredRowIds && sortedRowIds) {
        const filteredSet = new Set(filteredRowIds);
        const intersected = sortedRowIds.filter((id) => filteredSet.has(id));
        rowWhere.id = { in: intersected };
      } else if (sortedRowIds) {
        rowWhere.id = { in: sortedRowIds };
      } else if (filteredRowIds) {
        rowWhere.id = { in: filteredRowIds };
      }

      const [rows, totalCount] = await Promise.all([
        ctx.db.row.findMany({
          where: rowWhere,
          orderBy: undefined, // already sorted manually via sortedRowIds
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
