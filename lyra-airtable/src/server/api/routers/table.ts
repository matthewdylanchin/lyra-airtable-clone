import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const tableRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        name: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ensure base belongs to user
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) throw new Error("Base not found");

      const table = await ctx.db.table.create({
        data: {
          baseId: input.baseId,
          name: input.name,
        },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });

      return table;
    }),

  listByBase: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      // ensure base belongs to user
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) return [];

      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
    }),
});