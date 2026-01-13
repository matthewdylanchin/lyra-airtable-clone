import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { faker } from "@faker-js/faker";

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
      if (!base) throw new Error("UNAUTHORIZED");

      const result = await ctx.db.$transaction(async (tx) => {
        const table = await tx.table.create({
          data: { baseId: input.baseId, name: input.name },
          select: { id: true, name: true, createdAt: true, updatedAt: true },
        });

        const [nameCol, countCol] = await Promise.all([
          tx.column.create({
            data: { tableId: table.id, name: "Name", type: "TEXT", order: 0 },
            select: { id: true },
          }),
          tx.column.create({
            data: { tableId: table.id, name: "Count", type: "NUMBER", order: 1 },
            select: { id: true },
          }),
        ]);

        const rows = await Promise.all(
          Array.from({ length: 20 }).map((_, i) =>
            tx.row.create({
              data: { tableId: table.id, rowIndex: i },
              select: { id: true },
            }),
          ),
        );

        await tx.cell.createMany({
          data: rows.flatMap((r) => [
            { rowId: r.id, columnId: nameCol.id, textValue: faker.person.fullName() },
            {
              rowId: r.id,
              columnId: countCol.id,
              numberValue: faker.number.int({ min: 0, max: 1000 }),
            },
          ]),
        });

        return table;
      });

      return result;
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