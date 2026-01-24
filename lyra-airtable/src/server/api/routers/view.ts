import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const viewRouter = createTRPCRouter({
  // Get all views for a table
  getViews: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify user owns this table
      const table = await ctx.db.table.findFirst({
        where: {
          id: input.tableId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true },
      });

      if (!table) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return ctx.db.view.findMany({
        where: { tableId: input.tableId },
        orderBy: { order: "asc" },
      });
    }),

  // Create a new view
  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, name } = input;

      // Verify user owns this table
      const table = await ctx.db.table.findFirst({
        where: {
          id: tableId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true },
      });

      if (!table) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // Check for duplicate name
      const existing = await ctx.db.view.findUnique({
        where: {
          tableId_name: { tableId, name },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "View name must be unique",
        });
      }

      // Get next order value
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
          filterConjunction: "and",
        },
      });

      return newView;
    }),

  // Update a view (filters, sorts, hidden columns, name)
  update: protectedProcedure
    .input(
      z.object({
        viewId: z.string(),
        name: z.string().min(1).max(80).optional(),
        filtersJson: z.array(z.any()).optional(),
        filterConjunction: z.enum(["and", "or"]).optional(),
        sortsJson: z.array(z.any()).optional(),
        hiddenCols: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { viewId, ...updateData } = input;

      // Verify user owns this view's table
      const view = await ctx.db.view.findFirst({
        where: {
          id: viewId,
          table: {
            base: { ownerId: ctx.session.user.id },
          },
        },
        select: { id: true, tableId: true },
      });

      if (!view) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // If renaming, check for duplicates
      if (updateData.name) {
        const existing = await ctx.db.view.findFirst({
          where: {
            tableId: view.tableId,
            name: updateData.name,
            NOT: { id: viewId },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "View name must be unique",
          });
        }
      }

      return ctx.db.view.update({
        where: { id: viewId },
        data: updateData,
      });
    }),

  // Delete a view
  delete: protectedProcedure
    .input(z.object({ viewId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this view's table
      const view = await ctx.db.view.findFirst({
        where: {
          id: input.viewId,
          table: {
            base: { ownerId: ctx.session.user.id },
          },
        },
        select: { id: true },
      });

      if (!view) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return ctx.db.view.delete({
        where: { id: input.viewId },
      });
    }),

  // Reorder views
  reorder: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        viewIds: z.array(z.string()), // Array of view IDs in new order
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this table
      const table = await ctx.db.table.findFirst({
        where: {
          id: input.tableId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true },
      });

      if (!table) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // Update order for each view
      await Promise.all(
        input.viewIds.map((viewId, index) =>
          ctx.db.view.update({
            where: { id: viewId },
            data: { order: index },
          }),
        ),
      );

      return { success: true };
    }),
});
