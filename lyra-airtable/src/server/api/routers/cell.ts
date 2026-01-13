import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { ColumnType } from "generated/prisma";

export const cellRouter = createTRPCRouter({
  upsertValue: protectedProcedure
    .input(
      z.object({
        rowId: z.string(),
        columnId: z.string(),
        value: z.string(), // send as string; server coerces for NUMBER
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Ownership + consistency check:
      // row + column must belong to the same table, and base owner must be current user
      const row = await ctx.db.row.findFirst({
        where: {
          id: input.rowId,
          table: { base: { ownerId: ctx.session.user.id } },
        },
        select: { id: true, tableId: true },
      });
      if (!row) throw new TRPCError({ code: "UNAUTHORIZED" });

      const column = await ctx.db.column.findFirst({
        where: { id: input.columnId },
        select: { id: true, tableId: true, type: true },
      });
      if (!column) throw new TRPCError({ code: "NOT_FOUND" });

      if (column.tableId !== row.tableId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Row/column mismatch" });
      }

      const trimmed = input.value.trim();

      const data =
        column.type === ColumnType.NUMBER
          ? {
              numberValue: trimmed === "" ? null : Number(trimmed),
              textValue: null,
            }
          : {
              textValue: trimmed === "" ? null : trimmed,
              numberValue: null,
            };

      // If NUMBER and not parseable
      if (column.type === ColumnType.NUMBER && trimmed !== "" && Number.isNaN(Number(trimmed))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please enter a valid number",
        });
      }

      return ctx.db.cell.upsert({
        where: { rowId_columnId: { rowId: input.rowId, columnId: input.columnId } },
        create: { rowId: input.rowId, columnId: input.columnId, ...data },
        update: data,
        select: {
          id: true,
          rowId: true,
          columnId: true,
          textValue: true,
          numberValue: true,
          updatedAt: true,
        },
      });
    }),
});