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
        textValue: z.string().nullable(),
        numberValue: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Row/column mismatch",
        });
      }

      // Validation
      if (
        column.type === ColumnType.NUMBER &&
        input.numberValue !== null &&
        Number.isNaN(input.numberValue)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please enter a valid number",
        });
      }

      return ctx.db.cell.upsert({
        where: {
          rowId_columnId: {
            rowId: input.rowId,
            columnId: input.columnId,
          },
        },
        create: {
          rowId: input.rowId,
          columnId: input.columnId,
          textValue: input.textValue,
          numberValue: input.numberValue,
        },
        update: {
          textValue: input.textValue,
          numberValue: input.numberValue,
        },
      });
    }),
});
