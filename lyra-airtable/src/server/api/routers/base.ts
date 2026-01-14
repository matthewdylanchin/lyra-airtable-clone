import { z } from "zod";
import { faker } from "@faker-js/faker";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const baseRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        /** ---------- Create base ---------- */
        const base = await tx.base.create({
          data: {
            name: input.name,
            ownerId: ctx.session.user.id,
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        /** ---------- Create default table ---------- */
        const table = await tx.table.create({
          data: {
            baseId: base.id,
            name: "Table 1",
          },
          select: { id: true },
        });

        /** ---------- Create default columns ---------- */
        const columns = await Promise.all([
          tx.column.create({
            data: { tableId: table.id, name: "Name", type: "TEXT", order: 0 },
          }),
          tx.column.create({
            data: { tableId: table.id, name: "Notes", type: "TEXT", order: 1 },
          }),
          tx.column.create({
            data: {
              tableId: table.id,
              name: "Assignee",
              type: "TEXT",
              order: 2,
            },
          }),
          tx.column.create({
            data: { tableId: table.id, name: "Status", type: "TEXT", order: 3 },
          }),
          tx.column.create({
            data: {
              tableId: table.id,
              name: "Attachment",
              type: "TEXT",
              order: 4,
            },
          }),
          tx.column.create({
            data: {
              tableId: table.id,
              name: "Attachment Summary",
              type: "TEXT",
              order: 5,
            },
          }),
        ]);

        /** ---------- Create rows ---------- */
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

        /** ---------- Seed cells ---------- */
        await tx.cell.createMany({
          data: rows.flatMap((row) => [
            {
              rowId: row.id,
              columnId: columns[0].id,
              textValue: faker.person.fullName(),
            },
            {
              rowId: row.id,
              columnId: columns[1].id,
              textValue: faker.lorem.sentence(),
            },
            {
              rowId: row.id,
              columnId: columns[2].id,
              textValue: faker.person.firstName(),
            },
            {
              rowId: row.id,
              columnId: columns[3].id,
              textValue: faker.helpers.arrayElement([
                "Todo",
                "In Progress",
                "Done",
              ]),
            },
            {
              rowId: row.id,
              columnId: columns[4].id,
              textValue: faker.system.fileName(),
            },
            {
              rowId: row.id,
              columnId: columns[5].id,
              textValue: faker.lorem.words(3),
            },
          ]),
        });

        return {
          baseId: base.id,
          tableId: table.id,
        };
      });
    }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { ownerId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }),
});
