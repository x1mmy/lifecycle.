import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { supabaseAdmin } from "~/lib/supabase-admin";

/**
 * Settings Router
 *
 * Backend API endpoints for user settings and profile management
 * Handles business profile updates and notification preferences
 *
 * tRPC Learning Notes:
 * - Each procedure follows the pattern: .input() -> .query() or .mutation()
 * - .query() is for read operations (GET-like)
 * - .mutation() is for write operations (POST/PUT/DELETE-like)
 * - Zod schemas validate input data before it reaches the handler
 * - TRPCError provides structured error responses
 * - supabaseAdmin bypasses RLS for admin operations
 */

/**
 * Profile Row Type
 * Matches the Supabase profiles table schema
 */
interface ProfileRow {
  id: string;
  business_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  created_at: string;
}

/**
 * Settings Row Type
 * Matches the Supabase settings table schema
 * Updated to reflect the new two-tier notification system
 */
interface SettingsRow {
  id: string;
  user_id: string;
  alert_threshold: number;
  daily_expiry_alerts_enabled: boolean; // Daily operational emails
  weekly_report: boolean; // Weekly strategic reports
  created_at: string;
  updated_at: string;
}

/**
 * Supabase Error Type
 */
interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

/**
 * Profile Update Input Validation Schema
 * Validates profile fields before database updates
 */
const profileUpdateSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
});

/**
 * Notification Preferences Input Validation Schema
 * Updated for the new two-tier notification system
 */
const notificationPreferencesSchema = z.object({
  dailyExpiryAlerts: z.boolean(),
  alertThreshold: z.number().int().min(1).max(365, "Alert threshold must be between 1-365 days"),
  weeklyReport: z.boolean(),
});

/**
 * Password Reset Input Validation Schema
 * Validates email for password reset request
 */
const passwordResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const settingsRouter = createTRPCRouter({
  /**
   * Get User Profile
   *
   * Retrieves the user's business profile information
   * 
   * tRPC Pattern Explanation:
   * - .input() defines what data the client must send
   * - .query() indicates this is a read operation
   * - The handler function receives { input } with validated data
   * - Returns typed data or throws TRPCError
   *
   * @input userId - The authenticated user's ID
   * @returns User's profile data
   */
  getProfile: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Query the profiles table for the specific user
        const result = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", input.userId)
          .single() as { data: ProfileRow | null; error: SupabaseError | null };
        
        const data = result.data as Record<string, unknown> | null;
        const error = result.error;

        if (error) {
          console.error("[Settings getProfile Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch profile",
          });
        }

        // Return the profile data with proper typing
        return data as unknown as ProfileRow;

      } catch (error) {
        console.error("[Settings getProfile Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch profile",
        });
      }
    }),

  /**
   * Update User Profile
   *
   * Updates the user's business profile information
   * Note: Email updates are handled separately via Supabase Auth
   * 
   * tRPC Pattern Explanation:
   * - .mutation() indicates this modifies data
   * - Input validation ensures data integrity
   * - Database update uses .update() with .eq() for WHERE clause
   * - Returns updated data for optimistic UI updates
   *
   * @input userId - The authenticated user's ID
   * @input profile - Updated profile data (business name, phone, address)
   * @returns Updated profile data
   */
  updateProfile: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
        profile: profileUpdateSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Step 1: Update the profile in the database
        const result = await supabaseAdmin
          .from("profiles")
          .update({
            business_name: input.profile.businessName,
            phone: input.profile.phone,
            address: input.profile.address,
          })
          .eq("id", input.userId) // WHERE clause to target specific user
          .select() // Return the updated data
          .single() as { data: ProfileRow | null; error: SupabaseError | null };
        
        const data = result.data as Record<string, unknown> | null;
        const error = result.error;

        if (error) {
          console.error("[Settings updateProfile Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update profile",
          });
        }

        if (!data) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Profile not found",
          });
        }

        // Step 2: Update the user's metadata in Supabase Auth
        // This ensures the header shows the updated business name immediately
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          input.userId,
          {
            user_metadata: {
              business_name: input.profile.businessName,
              phone: input.profile.phone,
              address: input.profile.address,
            }
          }
        );

        if (authError) {
          console.error("[Settings updateProfile Auth Error]", authError);
          // Don't throw error here - the database update succeeded
          // The user can refresh the page to see the updated business name in the header
        }

        return data as unknown as ProfileRow;
      } catch (error) {
        console.error("[Settings updateProfile Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update profile",
        });
      }
    }),

  /**
   * Get Notification Preferences
   *
   * Retrieves the user's email notification settings
   * 
   * tRPC Pattern Explanation:
   * - Similar to getProfile but queries settings table
   * - Uses .single() since each user has exactly one settings record
   * - Error handling follows the same pattern
   *
   * @input userId - The authenticated user's ID
   * @returns User's notification preferences
   */
  getNotificationPreferences: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = await supabaseAdmin
          .from("settings")
          .select("*")
          .eq("user_id", input.userId)
          .single() as { data: SettingsRow | null; error: SupabaseError | null };
        
        const data = result.data as Record<string, unknown> | null;
        const error = result.error;

        if (error) {
          console.error("[Settings getNotificationPreferences Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch notification preferences",
          });
        }

        return data as unknown as SettingsRow;
      } catch (error) {
        console.error("[Settings getNotificationPreferences Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch notification preferences",
        });
      }
    }),

  /**
   * Update Notification Preferences
   *
   * Updates the user's email notification settings for the new two-tier system
   * 
   * tRPC Pattern Explanation:
   * - .mutation() for data modification
   * - Input validation ensures valid notification settings
   * - Database update with .eq() for WHERE clause
   * - Updates both new and legacy fields for backward compatibility
   * - Returns updated settings for UI sync
   *
   * @input userId - The authenticated user's ID
   * @input preferences - Updated notification preferences (two-tier system)
   * @returns Updated notification preferences
   */
  updateNotificationPreferences: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
        preferences: notificationPreferencesSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await supabaseAdmin
          .from("settings")
          .update({
            daily_expiry_alerts_enabled: input.preferences.dailyExpiryAlerts,
            alert_threshold: input.preferences.alertThreshold,
            weekly_report: input.preferences.weeklyReport,
          })
          .eq("user_id", input.userId)
          .select()
          .single() as { data: SettingsRow | null; error: SupabaseError | null };
        
        const data = result.data as Record<string, unknown> | null;
        const error = result.error;

        if (error) {
          console.error("[Settings updateNotificationPreferences Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update notification preferences",
          });
        }

        if (!data) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Settings not found",
          });
        }

        return data as unknown as SettingsRow;
      } catch (error) {
        console.error("[Settings updateNotificationPreferences Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update notification preferences",
        });
      }
    }),

  /**
   * Request Password Reset
   *
   * Initiates Supabase's built-in password reset flow
   * Sends an email with a magic link for password reset
   * 
   * tRPC Pattern Explanation:
   * - .mutation() for initiating the reset process
   * - Uses Supabase Auth API directly (not database)
   * - Returns success status rather than user data
   * - Error handling for auth-specific issues
   *
   * @input email - User's email address
   * @returns Success status
   */
  requestPasswordReset: publicProcedure
    .input(passwordResetSchema)
    .mutation(async ({ input }) => {
      try {
        // Use Supabase Auth API to send password reset email
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(
          input.email,
          {
            // Redirect URL after user clicks the reset link
            // This should point to your app's password reset page
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/reset-password`,
          }
        );

        if (error) {
          console.error("[Settings requestPasswordReset Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send password reset email",
          });
        }

        // Always return success for security (don't reveal if email exists)
        return { 
          success: true, 
          message: "If an account with this email exists, you will receive a password reset link." 
        };
      } catch (error) {
        console.error("[Settings requestPasswordReset Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send password reset email",
        });
      }
    }),
});
