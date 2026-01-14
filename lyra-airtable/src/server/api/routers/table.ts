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
        limit: z.number().int().min(1).max(200).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 50;

      const table = await ctx.db.table.findFirst({
        where: {
          id: input.tableId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true, name: true, baseId: true },
      });

      if (!table) throw new Error("UNAUTHORIZED");

      const [columns, rows] = await Promise.all([
        ctx.db.column.findMany({
          where: { tableId: table.id },
          orderBy: { order: "asc" },
          select: { id: true, name: true, type: true, order: true },
        }),
        ctx.db.row.findMany({
          where: { tableId: table.id },
          orderBy: { rowIndex: "asc" },
          take: limit,
          select: { id: true, rowIndex: true },
        }),
      ]);

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

      return { table, columns, rows, cells };
    }),
});
