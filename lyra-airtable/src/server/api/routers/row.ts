import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const rowRouter = createTRPCRouter({
  /** -----------------------------------------
   * CREATE ROW
   * ----------------------------------------- */
  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rowCount = await ctx.db.row.count({
        where: { tableId: input.tableId },
      });

      // Create new row at bottom
      const row = await ctx.db.row.create({
        data: {
          tableId: input.tableId,
          rowIndex: rowCount,
        },
        select: { id: true },
      });

      // Fill new row with new empty cells
      const columns = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
        select: { id: true },
      });

      await ctx.db.cell.createMany({
        data: columns.map((c) => ({
          rowId: row.id,
          columnId: c.id,
          textValue: "",
        })),
      });

      return row;
    }),

  /** -----------------------------------------
   * DELETE ROW
   * ----------------------------------------- */
  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input: rowId }) => {
      await ctx.db.cell.deleteMany({ where: { rowId } });
      await ctx.db.row.delete({ where: { id: rowId } });

      return { success: true };
    }),

  /** -----------------------------------------
   * ADD ROW (alias for create)
   * ----------------------------------------- */

  add: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId } = input;

      // 1. Find next rowIndex (append at end)
      const rowIndex = await ctx.db.row.count({
        where: { tableId },
      });

      // 2. Create the row
      const row = await ctx.db.row.create({
        data: {
          tableId,
          rowIndex,
        },
        select: { id: true },
      });

      // 3. Create empty cells for every existing column
      const columns = await ctx.db.column.findMany({
        where: { tableId },
        select: { id: true },
      });

      await ctx.db.cell.createMany({
        data: columns.map((c) => ({
          rowId: row.id,
          columnId: c.id,
          textValue: "",
        })),
      });

      return row;
    }),
  /** -----------------------------------------
   * INSERT ROW AT POSITION
   * ----------------------------------------- */

  insertAtPosition: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        anchorRowId: z.string(),
        position: z.enum(["above", "below"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, anchorRowId, position } = input;

      const anchor = await ctx.db.row.findUnique({
        where: { id: anchorRowId },
      });
      if (!anchor) throw new Error("Anchor row not found");

      const anchorIndex = anchor.rowIndex;
      const newIndex = position === "above" ? anchorIndex : anchorIndex + 1;

      return ctx.db.$transaction(async (tx) => {
        // Fetch rows to shift and update them from bottom to top
        const rowsToShift = await tx.row.findMany({
          where: {
            tableId,
            rowIndex: { gte: newIndex },
          },
          orderBy: { rowIndex: "desc" },
        });

        for (const r of rowsToShift) {
          await tx.row.update({
            where: { id: r.id },
            data: { rowIndex: r.rowIndex + 1 },
          });
        }

        const newRow = await tx.row.create({
          data: { tableId, rowIndex: newIndex },
        });

        const columns = await tx.column.findMany({
          where: { tableId },
          select: { id: true },
        });

        if (columns.length) {
          await tx.cell.createMany({
            data: columns.map((c) => ({
              rowId: newRow.id,
              columnId: c.id,
              textValue: "",
            })),
          });
        }

        return newRow;
      });
    }),

  /** -----------------------------------------
   * REORDER ROWS (future use)
   * ----------------------------------------- */
  reorder: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        order: z.array(z.object({ id: z.string(), rowIndex: z.number() })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates = input.order.map(({ id, rowIndex }) =>
        ctx.db.row.update({
          where: { id },
          data: { rowIndex },
        }),
      );

      await ctx.db.$transaction(updates);
      return { success: true };
    }),
});
