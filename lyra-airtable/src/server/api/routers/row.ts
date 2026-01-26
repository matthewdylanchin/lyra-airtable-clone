import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { faker } from "@faker-js/faker";

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
      const { tableId } = input;

      // Find current max rowIndex for this table
      const lastRow = await ctx.db.row.findFirst({
        where: { tableId },
        orderBy: { rowIndex: "desc" },
        select: { rowIndex: true },
      });

      const nextIndex = lastRow ? lastRow.rowIndex + 1 : 0;

      // Create new row at bottom
      const row = await ctx.db.row.create({
        data: {
          tableId,
          rowIndex: nextIndex,
        },
        select: { id: true },
      });

      // Fill new row with empty cells
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

  /** BULK ADD for 100k rows button */

  seedMany: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().int().min(1).max(100_000).default(100_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, count } = input;

      // Get the highest rowIndex
      const lastRow = await ctx.db.row.findFirst({
        where: { tableId },
        orderBy: { rowIndex: "desc" },
        select: { rowIndex: true },
      });

      const startIndex = lastRow ? lastRow.rowIndex + 1 : 0;

      const columns = await ctx.db.column.findMany({
        where: { tableId },
        select: { id: true, name: true, type: true },
      });

      // ✅ CREATE ALL ROWS FIRST (just rows, no cells) - this is FAST
      const allRowData = Array.from({ length: count }, (_, i) => ({
        tableId,
        rowIndex: startIndex + i,
      }));

      console.log(`🚀 Creating ${count} row records...`);
      await ctx.db.row.createMany({ data: allRowData });
      console.log(
        `✅ All ${count} rows created! Now filling with cell data...`,
      );

      // ✅ Start background cell population (don't await)
      void (async () => {
        try {
          const BATCH_SIZE = 5000; // Process 5k rows at a time
          const batches = Math.ceil(count / BATCH_SIZE);

          for (let batch = 0; batch < batches; batch++) {
            const batchStart = batch * BATCH_SIZE;
            const batchCount = Math.min(BATCH_SIZE, count - batchStart);

            // Fetch row IDs for this batch
            const batchRows = await ctx.db.row.findMany({
              where: {
                tableId,
                rowIndex: {
                  gte: startIndex + batchStart,
                  lt: startIndex + batchStart + batchCount,
                },
              },
              select: { id: true, rowIndex: true },
              orderBy: { rowIndex: "asc" },
            });

            // Build cell data with faker
            const allCells: {
              rowId: string;
              columnId: string;
              textValue?: string | null;
              numberValue?: number | null;
            }[] = [];

            for (const row of batchRows) {
              for (const col of columns) {
                if (col.type === "NUMBER") {
                  allCells.push({
                    rowId: row.id,
                    columnId: col.id,
                    textValue: null,
                    numberValue: faker.number.int({ min: 1, max: 10000 }),
                  });
                } else {
                  allCells.push({
                    rowId: row.id,
                    columnId: col.id,
                    textValue: faker.lorem.words(3),
                    numberValue: null,
                  });
                }
              }
            }

            // Insert cells in chunks
            const CELL_CHUNK_SIZE = 10_000;
            for (let i = 0; i < allCells.length; i += CELL_CHUNK_SIZE) {
              const chunk = allCells.slice(i, i + CELL_CHUNK_SIZE);
              await ctx.db.cell.createMany({ data: chunk });
            }

            const totalPopulated = batchStart + batchCount;
            console.log(
              `✅ Batch ${batch + 1}/${batches} complete (${totalPopulated}/${count} rows with data)`,
            );

            // Small delay between batches
            if (batch < batches - 1) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }

          console.log(`🎉 Finished populating ${count} rows with cell data`);
        } catch (error) {
          console.error("❌ Error in background cell population:", error);
        }
      })();

      // ✅ Return immediately - rows exist, cells are being populated
      return {
        success: true,
        insertedRows: count,
        message: `Created ${count} rows, populating cell data in background`,
      };
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
