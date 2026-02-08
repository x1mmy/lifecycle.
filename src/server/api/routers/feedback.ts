import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { supabaseAdmin } from "~/lib/supabase-admin";
import type { AdminFeedback, AdminFeedbackStats } from "~/types";

/**
 * Database row shape from feedback table (no FK to profiles in DB, so we join in code).
 */
interface FeedbackRow {
  id: string;
  user_id: string | null;
  email: string | null;
  type: string | null;
  message: string;
  created_at: string;
  upvotes_count: number;
}

/**
 * Feedback Router - Admin-only operations
 *
 * Provides procedures to list feedback (with profile business_name),
 * aggregate stats, and delete inappropriate feedback.
 * Uses supabaseAdmin; access control is enforced by middleware / admin pages.
 */
export const feedbackRouter = createTRPCRouter({
  /**
   * Get all feedback with optional sort and type filter.
   * Fetches business_name from profiles in a separate query (no FK required between feedback and profiles).
   *
   * @param sort - 'upvotes' (default) or 'newest'
   * @param typeFilter - optional: Bug | Feature | Improvement | Other
   */
  getAllFeedback: publicProcedure
    .input(
      z
        .object({
          sort: z.enum(["upvotes", "newest"]).default("upvotes"),
          typeFilter: z
            .enum(["Bug", "Feature", "Improvement", "Other", "All"])
            .optional()
            .default("All"),
        })
        .optional()
    )
    .query(async ({ input }): Promise<AdminFeedback[]> => {
      const sort = input?.sort ?? "upvotes";
      const typeFilter = input?.typeFilter ?? "All";

      try {
        let query = supabaseAdmin
          .from("feedback")
          .select("id, user_id, email, type, message, created_at, upvotes_count");

        if (typeFilter !== "All") {
          query = query.eq("type", typeFilter);
        }

        if (sort === "upvotes") {
          query = query.order("upvotes_count", { ascending: false });
        } else {
          query = query.order("created_at", { ascending: false });
        }

        const { data, error } = await query;

        if (error) {
          console.error("[Feedback getAllFeedback Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch feedback",
          });
        }

        const rows = (data ?? []) as FeedbackRow[];

        // No FK between feedback and profiles — fetch business_name by user_id in a second query
        const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
        const businessNameByUserId = new Map<string, string>();

        if (userIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id, business_name")
            .in("id", userIds);
          for (const p of (profiles ?? []) as { id: string; business_name: string }[]) {
            if (p.business_name) businessNameByUserId.set(p.id, p.business_name);
          }
        }

        return rows.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          email: row.email,
          type: row.type,
          message: row.message,
          created_at: row.created_at,
          upvotes_count: row.upvotes_count ?? 0,
          business_name: row.user_id ? businessNameByUserId.get(row.user_id) : undefined,
        }));
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[Feedback getAllFeedback Error]", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch feedback",
        });
      }
    }),

  /**
   * Aggregate stats: total feedback, total upvotes, most popular type, count this week.
   */
  getFeedbackStats: publicProcedure.query(async (): Promise<AdminFeedbackStats> => {
    try {
      const { data: allFeedback, error: fetchError } = await supabaseAdmin
        .from("feedback")
        .select("id, type, upvotes_count, created_at");

      if (fetchError) {
        console.error("[Feedback getFeedbackStats Error]", fetchError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch feedback stats",
        });
      }

      const rows = allFeedback ?? [];
      const totalFeedback = rows.length;
      const totalUpvotes = rows.reduce(
        (sum, r) => sum + (Number(r.upvotes_count) || 0),
        0
      );

      // Start of current week (Sunday 00:00) in Australia/Sydney
      const now = new Date();
      const day = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - day);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStartIso = startOfWeek.toISOString();

      const feedbackThisWeek = rows.filter(
        (r) => r.created_at && r.created_at >= weekStartIso
      ).length;

      // Most common type (excluding null/empty)
      const typeCounts = new Map<string, number>();
      for (const r of rows) {
        const t = r.type?.trim() || "Other";
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      }
      let topType: string | null = null;
      let maxCount = 0;
      typeCounts.forEach((count, type) => {
        if (count > maxCount) {
          maxCount = count;
          topType = type;
        }
      });

      return {
        totalFeedback,
        totalUpvotes,
        topType,
        feedbackThisWeek,
      };
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      console.error("[Feedback getFeedbackStats Error]", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch feedback stats",
      });
    }
  }),

  /**
   * Delete a single feedback by id (admin only; enforce in UI/middleware).
   * If feedback_upvotes has FK with ON DELETE CASCADE, rows are removed automatically.
   */
  deleteFeedback: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      try {
        const { error } = await supabaseAdmin
          .from("feedback")
          .delete()
          .eq("id", input.id);

        if (error) {
          console.error("[Feedback deleteFeedback Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete feedback",
          });
        }

        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[Feedback deleteFeedback Error]", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete feedback",
        });
      }
    }),
});
