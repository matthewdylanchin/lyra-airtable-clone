import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { ColumnType } from "generated/prisma";

export const columnRouter = createTRPCRouter({
  /** -----------------------------------------
   * CREATE COLUMN
   * ----------------------------------------- */
  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().min(1),
        type: z.nativeEnum(ColumnType).default("TEXT"), // ← FIXED
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const currentCount = await ctx.db.column.count({
        where: { tableId: input.tableId },
      });

      // Create the new column at the end
      const column = await ctx.db.column.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          type: input.type,
          order: currentCount,
        },
      });

      // Fill the new column with empty cells for all existing rows
      const rows = await ctx.db.row.findMany({
        where: { tableId: input.tableId },
        select: { id: true },
      });

      await ctx.db.cell.createMany({
        data: rows.map((r) => ({
          rowId: r.id,
          columnId: column.id,
          textValue: "",
        })),
      });

      return column;
    }),

  /** -----------------------------------------
   * RENAME COLUMN
   * ----------------------------------------- */
  rename: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.column.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  /** -----------------------------------------
   * DELETE COLUMN
   * ----------------------------------------- */
  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input: columnId }) => {
      // delete all cells in the column
      await ctx.db.cell.deleteMany({
        where: { columnId },
      });

      // delete the column itself
      await ctx.db.column.delete({
        where: { id: columnId },
      });

      return { success: true };
    }),

  /** -----------------------------------------
   * REORDER COLUMNS (optional for later)
   * ----------------------------------------- */
  reorder: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        order: z.array(z.object({ id: z.string(), order: z.number() })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates = input.order.map(({ id, order }) =>
        ctx.db.column.update({
          where: { id },
          data: { order },
        }),
      );

      await ctx.db.$transaction(updates);
      return { success: true };
    }),
});
