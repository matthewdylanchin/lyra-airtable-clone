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

  rename: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: {
          id: input.tableId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true },
      });

      if (!table) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      try {
        return await ctx.db.table.update({
          where: { id: input.tableId },
          data: { name: input.name },
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        });
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
          message: "Failed to rename table",
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: {
          id: input.tableId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true },
      });

      if (!table) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await ctx.db.table.delete({
        where: { id: input.tableId },
      });

      return { success: true };
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
        const result = await ctx.db.$transaction(
          async (tx) => {
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
                {
                  tableId: table.id,
                  name: "Attachment",
                  type: "TEXT",
                  order: 4,
                },
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

            await tx.view.create({
              data: {
                tableId: table.id,
                name: "Grid view",
                order: 0,
                filtersJson: [],
                sortsJson: [],
                hiddenCols: [],
                filterConjunction: "and",
              },
            });

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
                      return { rowId: r.id, columnId: c.id, textValue: null };
                  }
                }),
              ),
            });

            return table;
          },
          { maxWait: 10000, timeout: 30000 },
        );

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

  // ============================================================
  // NEW: Windowed pagination endpoint
  // ============================================================
  getDataWindowed: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(5000).default(500),
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
      const {
        tableId,
        offset,
        limit,
        filters,
        sorts,
        searchQuery,
        filterConjunction,
      } = input;

      // Verify user owns this table
      const table = await ctx.db.table.findFirst({
        where: {
          id: tableId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true, name: true, baseId: true },
      });

      if (!table) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Get columns
      const columns = await ctx.db.column.findMany({
        where: { tableId: table.id },
        orderBy: { order: "asc" },
        select: { id: true, name: true, type: true, order: true },
      });

      // ========== FILTERING LOGIC ==========
      let filteredRowIds: string[] | null = null;

      if (filters?.length) {
        const cellFilterPromises = filters.map(async (filter) => {
          const column = columns.find((c) => c.id === filter.columnId);
          const isNumberColumn = column?.type === "NUMBER";

          let whereClause: Record<string, unknown> = {
            columnId: filter.columnId,
          };

          if (isNumberColumn) {
            const val = Number(filter.value);
            switch (filter.operator) {
              case "equals":
                whereClause.numberValue = { equals: val };
                break;
              case "not_equals":
                whereClause.numberValue = { not: { equals: val } };
                break;
              case "gt":
                whereClause.numberValue = { gt: val };
                break;
              case "gte":
                whereClause.numberValue = { gte: val };
                break;
              case "lt":
                whereClause.numberValue = { lt: val };
                break;
              case "lte":
                whereClause.numberValue = { lte: val };
                break;
              case "empty":
                whereClause.numberValue = null;
                break;
              case "not_empty":
                whereClause.numberValue = { not: null };
                break;
            }
          } else {
            switch (filter.operator) {
              case "contains":
                whereClause.textValue = {
                  contains: filter.value,
                  mode: "insensitive",
                };
                break;
              case "not_contains":
                whereClause.NOT = {
                  textValue: { contains: filter.value, mode: "insensitive" },
                };
                break;
              case "equals":
                whereClause.textValue = {
                  equals: filter.value,
                  mode: "insensitive",
                };
                break;
              case "not_equals":
                whereClause.NOT = {
                  textValue: { equals: filter.value, mode: "insensitive" },
                };
                break;
              case "empty":
                whereClause.OR = [{ textValue: null }, { textValue: "" }];
                break;
              case "not_empty":
                whereClause.AND = [
                  { textValue: { not: null } },
                  { textValue: { not: "" } },
                ];
                break;
            }
          }

          const matchingCells = await ctx.db.cell.findMany({
            where: whereClause,
            select: { rowId: true },
            distinct: ["rowId"],
          });

          return new Set(matchingCells.map((c) => c.rowId));
        });

        const rowIdSets = await Promise.all(cellFilterPromises);

        if (rowIdSets.length > 0) {
          if (filterConjunction === "or") {
            const allRowIds = new Set<string>();
            rowIdSets.forEach((set) => set.forEach((id) => allRowIds.add(id)));
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

      // ========== SEARCH LOGIC ==========
      if (searchQuery && searchQuery.trim()) {
        const searchCells = await ctx.db.cell.findMany({
          where: {
            row: { tableId: table.id },
            textValue: { contains: searchQuery, mode: "insensitive" },
          },
          select: { rowId: true },
          distinct: ["rowId"],
        });

        const searchRowIds = new Set(searchCells.map((c) => c.rowId));

        if (filteredRowIds) {
          filteredRowIds = filteredRowIds.filter((id) => searchRowIds.has(id));
        } else {
          filteredRowIds = Array.from(searchRowIds);
        }
      }

      // ========== GET TOTAL COUNT ==========
      let totalCount: number;

      if (filteredRowIds !== null) {
        totalCount = filteredRowIds.length;
      } else {
        totalCount = await ctx.db.row.count({ where: { tableId: table.id } });
      }

      // ========== SORTING + WINDOWED FETCH ==========
      let rows: Array<{ id: string; rowIndex: number }>;

      if (sorts && sorts.length > 0) {
        // Build sort query
        const sortColumns = sorts.map((sort) => {
          const column = columns.find((c) => c.id === sort.columnId);
          if (!column) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Sort column not found: ${sort.columnId}`,
            });
          }
          return { ...sort, column };
        });

        const selectParts = sortColumns
          .map((sort, index) => {
            const isNumber = sort.column.type === "NUMBER";
            const colId = sort.columnId;

            if (isNumber) {
              return `
                MAX(CASE WHEN c."columnId" = '${colId}' THEN 
                  CASE WHEN c."numberValue" IS NULL THEN 1 ELSE 0 END 
                END) as null_sort_${index},
                MAX(CASE WHEN c."columnId" = '${colId}' THEN c."numberValue" END) as sort_val_${index}
              `;
            } else {
              return `
                MAX(CASE WHEN c."columnId" = '${colId}' THEN 
                  CASE WHEN c."textValue" IS NULL OR c."textValue" = '' THEN 1 ELSE 0 END 
                END) as null_sort_${index},
                MAX(CASE WHEN c."columnId" = '${colId}' THEN LOWER(c."textValue") END) as sort_val_${index}
              `;
            }
          })
          .join(",");

        const orderByParts = sortColumns
          .map((sort, index) => {
            const direction = sort.direction.toUpperCase();
            return `null_sort_${index} ASC, sort_val_${index} ${direction}`;
          })
          .join(", ");

        let sortedRows: Array<{ rowId: string }>;

        if (filteredRowIds && filteredRowIds.length > 0) {
          // Use ANY with array for large datasets - no bind variable limit
          sortedRows = await ctx.db.$queryRawUnsafe<Array<{ rowId: string }>>(
            `
            SELECT r.id as "rowId",
              ${selectParts}
            FROM "Row" r
            INNER JOIN "Cell" c ON c."rowId" = r.id
            WHERE r."tableId" = $1
              AND r.id = ANY($2::text[])
            GROUP BY r.id
            ORDER BY ${orderByParts}
            OFFSET ${offset}
            LIMIT ${limit}
            `,
            table.id,
            filteredRowIds,
          );
        } else {
          sortedRows = await ctx.db.$queryRawUnsafe<Array<{ rowId: string }>>(
            `
            SELECT r.id as "rowId",
              ${selectParts}
            FROM "Row" r
            INNER JOIN "Cell" c ON c."rowId" = r.id
            WHERE r."tableId" = $1
            GROUP BY r.id
            ORDER BY ${orderByParts}
            OFFSET ${offset}
            LIMIT ${limit}
            `,
            table.id,
          );
        }

        const sortedRowIds = sortedRows.map((r) => r.rowId);

        if (sortedRowIds.length > 0) {
          const rowsData = await ctx.db.row.findMany({
            where: { id: { in: sortedRowIds } },
            select: { id: true, rowIndex: true },
          });

          // Preserve sort order
          const rowMap = new Map(rowsData.map((r) => [r.id, r]));
          rows = sortedRowIds
            .map((id) => rowMap.get(id))
            .filter((r): r is NonNullable<typeof r> => r !== undefined);
        } else {
          rows = [];
        }
      } else {
        // No sorting - use rowIndex order with OFFSET/LIMIT
        if (filteredRowIds && filteredRowIds.length > 0) {
          // Use ANY with array for large datasets
          const rowsRaw = await ctx.db.$queryRawUnsafe<
            Array<{ id: string; rowIndex: number }>
          >(
            `
            SELECT id, "rowIndex"
            FROM "Row"
            WHERE "tableId" = $1
              AND id = ANY($2::text[])
            ORDER BY "rowIndex" ASC
            OFFSET ${offset}
            LIMIT ${limit}
            `,
            table.id,
            filteredRowIds,
          );
          rows = rowsRaw;
        } else {
          rows = await ctx.db.row.findMany({
            where: { tableId: table.id },
            orderBy: { rowIndex: "asc" },
            skip: offset,
            take: limit,
            select: { id: true, rowIndex: true },
          });
        }
      }

      // ========== FETCH CELLS ==========
      const rowIds = rows.map((r) => r.id);

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
        rows,
        cells,
        totalCount,
        offset,
        limit,
        hasMore: offset + rows.length < totalCount,
      };
    }),

  // Keep the old getData for backward compatibility during migration
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
      const {
        tableId,
        limit,
        cursor,
        filters,
        sorts,
        searchQuery,
        filterConjunction,
      } = input;

      const table = await ctx.db.table.findFirst({
        where: {
          id: tableId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true, name: true, baseId: true },
      });

      if (!table) throw new TRPCError({ code: "UNAUTHORIZED" });

      const columns = await ctx.db.column.findMany({
        where: { tableId: table.id },
        orderBy: { order: "asc" },
        select: { id: true, name: true, type: true, order: true },
      });

      let filteredRowIds: string[] | null = null;

      if (filters?.length) {
        const cellFilterPromises = filters.map(async (filter) => {
          const column = columns.find((c) => c.id === filter.columnId);
          const isNumberColumn = column?.type === "NUMBER";

          let whereClause: Record<string, unknown> = {
            columnId: filter.columnId,
          };

          if (isNumberColumn) {
            const val = Number(filter.value);
            switch (filter.operator) {
              case "equals":
                whereClause.numberValue = { equals: val };
                break;
              case "not_equals":
                whereClause.numberValue = { not: { equals: val } };
                break;
              case "gt":
                whereClause.numberValue = { gt: val };
                break;
              case "gte":
                whereClause.numberValue = { gte: val };
                break;
              case "lt":
                whereClause.numberValue = { lt: val };
                break;
              case "lte":
                whereClause.numberValue = { lte: val };
                break;
              case "empty":
                whereClause.numberValue = null;
                break;
              case "not_empty":
                whereClause.numberValue = { not: null };
                break;
            }
          } else {
            switch (filter.operator) {
              case "contains":
                whereClause.textValue = {
                  contains: filter.value,
                  mode: "insensitive",
                };
                break;
              case "not_contains":
                whereClause.NOT = {
                  textValue: { contains: filter.value, mode: "insensitive" },
                };
                break;
              case "equals":
                whereClause.textValue = {
                  equals: filter.value,
                  mode: "insensitive",
                };
                break;
              case "not_equals":
                whereClause.NOT = {
                  textValue: { equals: filter.value, mode: "insensitive" },
                };
                break;
              case "empty":
                whereClause.OR = [{ textValue: null }, { textValue: "" }];
                break;
              case "not_empty":
                whereClause.AND = [
                  { textValue: { not: null } },
                  { textValue: { not: "" } },
                ];
                break;
            }
          }

          const matchingCells = await ctx.db.cell.findMany({
            where: whereClause,
            select: { rowId: true },
            distinct: ["rowId"],
          });

          return new Set(matchingCells.map((c) => c.rowId));
        });

        const rowIdSets = await Promise.all(cellFilterPromises);

        if (rowIdSets.length > 0) {
          if (filterConjunction === "or") {
            const allRowIds = new Set<string>();
            rowIdSets.forEach((set) => set.forEach((id) => allRowIds.add(id)));
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

      let totalCount: number;

      if (filteredRowIds !== null) {
        totalCount = filteredRowIds.length;
      } else {
        totalCount = await ctx.db.row.count({ where: { tableId: table.id } });
      }

      let rows: Array<{ id: string; rowIndex: number }>;

      if (sorts && sorts.length > 0) {
        const sortColumns = sorts.map((sort) => {
          const column = columns.find((c) => c.id === sort.columnId);
          if (!column) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Sort column not found: ${sort.columnId}`,
            });
          }
          return { ...sort, column };
        });

        const selectParts = sortColumns
          .map((sort, index) => {
            const isNumber = sort.column.type === "NUMBER";
            const colId = sort.columnId;

            if (isNumber) {
              return `
                MAX(CASE WHEN c."columnId" = '${colId}' THEN 
                  CASE WHEN c."numberValue" IS NULL THEN 1 ELSE 0 END 
                END) as null_sort_${index},
                MAX(CASE WHEN c."columnId" = '${colId}' THEN c."numberValue" END) as sort_val_${index}
              `;
            } else {
              return `
                MAX(CASE WHEN c."columnId" = '${colId}' THEN 
                  CASE WHEN c."textValue" IS NULL OR c."textValue" = '' THEN 1 ELSE 0 END 
                END) as null_sort_${index},
                MAX(CASE WHEN c."columnId" = '${colId}' THEN LOWER(c."textValue") END) as sort_val_${index}
              `;
            }
          })
          .join(",");

        const orderByParts = sortColumns
          .map((sort, index) => {
            const direction = sort.direction.toUpperCase();
            return `null_sort_${index} ASC, sort_val_${index} ${direction}`;
          })
          .join(", ");

        let sortedRows: Array<{ rowId: string }>;

        if (filteredRowIds && filteredRowIds.length > 0) {
          sortedRows = await ctx.db.$queryRawUnsafe<Array<{ rowId: string }>>(
            `
            SELECT r.id as "rowId",
              ${selectParts}
            FROM "Row" r
            INNER JOIN "Cell" c ON c."rowId" = r.id
            WHERE r."tableId" = $1
              AND r.id = ANY($2::text[])
            GROUP BY r.id
            ORDER BY ${orderByParts}
            LIMIT ${limit + 1}
            `,
            table.id,
            filteredRowIds,
          );
        } else {
          sortedRows = await ctx.db.$queryRawUnsafe<Array<{ rowId: string }>>(
            `
            SELECT r.id as "rowId",
              ${selectParts}
            FROM "Row" r
            INNER JOIN "Cell" c ON c."rowId" = r.id
            WHERE r."tableId" = $1
            GROUP BY r.id
            ORDER BY ${orderByParts}
            LIMIT ${limit + 1}
            `,
            table.id,
          );
        }

        const sortedRowIds = sortedRows.map((r) => r.rowId);
        const rowsToFetch = sortedRowIds.slice(0, limit + 1);

        if (rowsToFetch.length > 0) {
          const rowsData = await ctx.db.row.findMany({
            where: { id: { in: rowsToFetch } },
            select: { id: true, rowIndex: true },
          });

          const rowMap = new Map(rowsData.map((r) => [r.id, r]));
          rows = rowsToFetch
            .map((id) => rowMap.get(id))
            .filter((r): r is NonNullable<typeof r> => r !== undefined);
        } else {
          rows = [];
        }
      } else {
        if (filteredRowIds && filteredRowIds.length > 0) {
          const rowsRaw = await ctx.db.$queryRawUnsafe<
            Array<{ id: string; rowIndex: number }>
          >(
            `
            SELECT id, "rowIndex"
            FROM "Row"
            WHERE "tableId" = $1
              AND id = ANY($2::text[])
              ${cursor !== undefined ? `AND "rowIndex" > ${cursor}` : ""}
            ORDER BY "rowIndex" ASC
            LIMIT ${limit + 1}
            `,
            table.id,
            filteredRowIds,
          );
          rows = rowsRaw;
        } else {
          rows = await ctx.db.row.findMany({
            where: {
              tableId: table.id,
              ...(cursor !== undefined ? { rowIndex: { gt: cursor } } : {}),
            },
            orderBy: { rowIndex: "asc" },
            take: limit + 1,
            select: { id: true, rowIndex: true },
          });
        }
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
