import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient

export const viewRouter = createTRPCRouter({
  createView: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, name } = input;

      // ✅ Correct — use ctx.db
      const existing = await ctx.db.view.findUnique({
        where: {
          tableId_name: {
            tableId,
            name,
          },
        },
      });

      if (existing) {
        throw new Error("View name must be unique.");
      }

      const viewCount = await ctx.db.view.count({
        where: { tableId },
      });

      const newView = await ctx.db.view.create({
        data: {
          tableId,
          name,
          order: viewCount,
          filtersJson: [],
          sortsJson: [],
          hiddenCols: [],
        },
      });

      return newView;
    }),

  getViews: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.view.findMany({
        where: { tableId: input.tableId },
        orderBy: { order: "asc" },
      });
    }),
});
