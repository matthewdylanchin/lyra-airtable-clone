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
    .input(z.object({ columnId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { columnId } = input;

      await ctx.db.cell.deleteMany({
        where: { columnId },
      });

      await ctx.db.column.delete({
        where: { id: columnId },
      });

      return { success: true };
    }),

  insertAtPosition: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        anchorColumnId: z.string(),
        position: z.enum(["before", "after"]),
        name: z.string().min(1),
        type: z.nativeEnum(ColumnType),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, anchorColumnId, position, name, type } = input;

      // 1. Fetch all columns
      const columns = await ctx.db.column.findMany({
        where: { tableId },
        orderBy: { order: "asc" },
      });

      const index = columns.findIndex((c) => c.id === anchorColumnId);
      if (index === -1) throw new Error("Column not found");

      // 2. Determine insertion index
      const newIndex = position === "before" ? index : index + 1;

      // 3. Shift others
      // Fetch columns we need to shift
      const toShift = await ctx.db.column.findMany({
        where: {
          tableId,
          order: { gte: newIndex },
        },
        orderBy: { order: "desc" }, // IMPORTANT
      });

      // Shift 1-by-1 to avoid conflicts
      for (const col of toShift) {
        await ctx.db.column.update({
          where: { id: col.id },
          data: { order: col.order + 1 },
        });
      }

      // 4. Create the new column
      const column = await ctx.db.column.create({
        data: {
          tableId,
          name,
          type,
          order: newIndex,
        },
      });

      // 5. Create empty cells
      const rows = await ctx.db.row.findMany({
        where: { tableId },
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
