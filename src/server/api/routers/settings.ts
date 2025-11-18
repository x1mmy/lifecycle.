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

interface CategoryProductSummary {
  id: string;
  name: string;
  expiryDate: string;
  quantity: number | null;
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
  alertThreshold: z
    .number()
    .int()
    .min(1)
    .max(365, "Alert threshold must be between 1-365 days"),
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
        const result = (await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", input.userId)
          .single()) as {
          data: ProfileRow | null;
          error: SupabaseError | null;
        };

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
        const result = (await supabaseAdmin
          .from("profiles")
          .update({
            business_name: input.profile.businessName,
            phone: input.profile.phone,
            address: input.profile.address,
          })
          .eq("id", input.userId) // WHERE clause to target specific user
          .select() // Return the updated data
          .single()) as {
          data: ProfileRow | null;
          error: SupabaseError | null;
        };

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
        const { error: authError } =
          await supabaseAdmin.auth.admin.updateUserById(input.userId, {
            user_metadata: {
              business_name: input.profile.businessName,
              phone: input.profile.phone,
              address: input.profile.address,
            },
          });

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
        const result = (await supabaseAdmin
          .from("settings")
          .select("*")
          .eq("user_id", input.userId)
          .single()) as {
          data: SettingsRow | null;
          error: SupabaseError | null;
        };

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
        const result = (await supabaseAdmin
          .from("settings")
          .update({
            daily_expiry_alerts_enabled: input.preferences.dailyExpiryAlerts,
            alert_threshold: input.preferences.alertThreshold,
            weekly_report: input.preferences.weeklyReport,
          })
          .eq("user_id", input.userId)
          .select()
          .single()) as {
          data: SettingsRow | null;
          error: SupabaseError | null;
        };

        const data = result.data as Record<string, unknown> | null;
        const error = result.error;

        if (error) {
          console.error(
            "[Settings updateNotificationPreferences Error]",
            error,
          );
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
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/reset-password`,
          },
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
          message:
            "If an account with this email exists, you will receive a password reset link.",
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

  /**
   * Get All Categories
   *
   * Retrieves all categories for a specific user
   *
   * @input userId - The authenticated user's ID
   * @returns Array of categories
   */
  getCategories: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = (await supabaseAdmin
          .from("categories")
          .select("*")
          .eq("user_id", input.userId)
          .order("name", { ascending: true })) as {
          data: Array<{
            id: string;
            user_id: string;
            name: string;
            description: string | null;
            created_at: string;
            updated_at: string;
          }> | null;
          error: SupabaseError | null;
        };

        const data = result.data;
        const error = result.error;

        if (error) {
          console.error("[Settings getCategories Error]", error);
          // Check if table doesn't exist (common migration issue)
          if (
            error.code === "42P01" ||
            error.message?.includes("does not exist")
          ) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "Categories table not found. Please run the database migration: 20250115000004_create_categories_table.sql",
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to fetch categories",
          });
        }

        return data ?? [];
      } catch (error) {
        console.error("[Settings getCategories Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch categories",
        });
      }
    }),

  /**
   * Create Category
   *
   * Creates a new category for the user
   *
   * @input userId - The authenticated user's ID
   * @input name - Category name
   * @input description - Optional category description
   * @returns Created category
   */
  createCategory: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
        name: z
          .string()
          .min(1, "Category name is required")
          .max(100, "Category name must be less than 100 characters"),
        description: z
          .string()
          .max(500, "Description must be less than 500 characters")
          .optional()
          .nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = (await supabaseAdmin
          .from("categories")
          .insert({
            user_id: input.userId,
            name: input.name.trim(),
            description: input.description?.trim() ?? null,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()) as {
          data: {
            id: string;
            user_id: string;
            name: string;
            description: string | null;
            created_at: string;
            updated_at: string;
          } | null;
          error: SupabaseError | null;
        };

        const data = result.data;
        const error = result.error;

        if (error) {
          console.error("[Settings createCategory Error]", error);
          // Check if it's a unique constraint violation
          if (error.code === "23505") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A category with this name already exists",
            });
          }
          // Check if table doesn't exist (common migration issue)
          if (
            error.code === "42P01" ||
            error.message?.includes("does not exist")
          ) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "Categories table not found. Please run the database migration: 20250115000004_create_categories_table.sql",
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to create category",
          });
        }

        if (!data) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create category",
          });
        }

        return data;
      } catch (error) {
        console.error("[Settings createCategory Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create category",
        });
      }
    }),

  /**
   * Get Products By Category
   *
   * Retrieves all products that belong to a specific category
   * Used for showing contextual info inside the category modal
   *
   * @input userId - The authenticated user's ID
   * @input categoryId - The category ID to inspect
   */
  getCategoryProducts: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
        categoryId: z.string().uuid("Invalid category ID"),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Fetch the category name to match products
        const { data: category, error: categoryError } = await supabaseAdmin
          .from("categories")
          .select("name")
          .eq("id", input.categoryId)
          .eq("user_id", input.userId)
          .single();

        if (categoryError || !category) {
          console.error(
            "[Settings getCategoryProducts category Error]",
            categoryError,
          );
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Category not found",
          });
        }

        const { data, error } = await supabaseAdmin
          .from("products")
          .select("id, name, expiry_date, quantity")
          .eq("user_id", input.userId)
          .eq("category", category.name)
          .order("expiry_date", { ascending: true });

        if (error) {
          console.error("[Settings getCategoryProducts Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch category products",
          });
        }

        const products =
          (
            data as Array<{
              id: string;
              name: string;
              expiry_date: string;
              quantity: number | null;
            }>
          )?.map((product) => ({
            id: product.id,
            name: product.name,
            expiryDate: product.expiry_date,
            quantity: product.quantity,
          })) ?? [];

        return {
          categoryName: category.name,
          products,
        };
      } catch (error) {
        console.error("[Settings getCategoryProducts Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch category products",
        });
      }
    }),

  /**
   * Update Category
   *
   * Updates an existing category
   *
   * @input categoryId - The category ID
   * @input userId - The authenticated user's ID (for security)
   * @input name - Updated category name
   * @input description - Updated category description
   * @returns Updated category
   */
  updateCategory: publicProcedure
    .input(
      z.object({
        categoryId: z.string().uuid("Invalid category ID"),
        userId: z.string().uuid("Invalid user ID"),
        name: z
          .string()
          .min(1, "Category name is required")
          .max(100, "Category name must be less than 100 characters"),
        description: z
          .string()
          .max(500, "Description must be less than 500 characters")
          .optional()
          .nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Step 1: Get the old category name before updating
        const { data: oldCategory } = await supabaseAdmin
          .from("categories")
          .select("name")
          .eq("id", input.categoryId)
          .eq("user_id", input.userId)
          .single();

        if (!oldCategory) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Category not found or you don't have permission to update it",
          });
        }

        const oldCategoryName = oldCategory.name;
        const newCategoryName = input.name.trim();

        // Step 2: Update the category in categories table
        const result = (await supabaseAdmin
          .from("categories")
          .update({
            name: newCategoryName,
            description: input.description?.trim() ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.categoryId)
          .eq("user_id", input.userId) // Ensure user owns this category
          .select()
          .single()) as {
          data: {
            id: string;
            user_id: string;
            name: string;
            description: string | null;
            created_at: string;
            updated_at: string;
          } | null;
          error: SupabaseError | null;
        };

        const data = result.data;
        const error = result.error;

        if (error) {
          console.error("[Settings updateCategory Error]", error);
          // Check if it's a unique constraint violation
          if (error.code === "23505") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A category with this name already exists",
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update category",
          });
        }

        if (!data) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Category not found or you don't have permission to update it",
          });
        }

        // Step 3: Update all products that use the old category name
        // Only update if the name actually changed
        if (oldCategoryName !== newCategoryName) {
          const { error: productsUpdateError } = await supabaseAdmin
            .from("products")
            .update({ category: newCategoryName })
            .eq("user_id", input.userId)
            .eq("category", oldCategoryName);

          if (productsUpdateError) {
            console.error(
              "[Settings updateCategory] Failed to sync products:",
              productsUpdateError,
            );
            // Don't fail the category update, but log the error
            // The category was updated successfully, products will sync on next product operation
          } else {
            console.log(
              `[Settings updateCategory] Synced products from "${oldCategoryName}" to "${newCategoryName}"`,
            );
          }
        }

        // Step 4: Fetch all products in this category to return to the client
        const { data: categoryProductsData, error: categoryProductsError } =
          await supabaseAdmin
            .from("products")
            .select("id, name, expiry_date, quantity")
            .eq("user_id", input.userId)
            .eq("category", newCategoryName)
            .order("expiry_date", { ascending: true });

        if (categoryProductsError) {
          console.error(
            "[Settings updateCategory] Failed to fetch category products:",
            categoryProductsError,
          );
        }

        const products: CategoryProductSummary[] =
          (
            categoryProductsData as Array<{
              id: string;
              name: string;
              expiry_date: string;
              quantity: number | null;
            }>
          )?.map((product) => ({
            id: product.id,
            name: product.name,
            expiryDate: product.expiry_date,
            quantity: product.quantity,
          })) ?? [];

        return {
          category: data,
          products,
        };
      } catch (error) {
        console.error("[Settings updateCategory Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update category",
        });
      }
    }),

  /**
   * Delete Category
   *
   * Deletes a category
   *
   * @input categoryId - The category ID
   * @input userId - The authenticated user's ID (for security)
   * @returns Success status
   */
  deleteCategory: publicProcedure
    .input(
      z.object({
        categoryId: z.string().uuid("Invalid category ID"),
        userId: z.string().uuid("Invalid user ID"),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Step 1: Get the category name before deleting
        const { data: category } = await supabaseAdmin
          .from("categories")
          .select("name")
          .eq("id", input.categoryId)
          .eq("user_id", input.userId)
          .single();

        if (!category) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Category not found or you don't have permission to delete it",
          });
        }

        const categoryName = category.name;

        // Step 2: Check if any products are using this category
        const { data: productsUsingCategory, error: productsCheckError } =
          await supabaseAdmin
            .from("products")
            .select("id")
            .eq("user_id", input.userId)
            .eq("category", categoryName)
            .limit(1); // We only need to know if any exist

        if (productsCheckError) {
          console.error(
            "[Settings deleteCategory] Error checking products:",
            productsCheckError,
          );
          // Continue with deletion attempt even if check fails
        }

        // Step 3: Prevent deletion if products are using this category
        if (productsUsingCategory && productsUsingCategory.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Cannot delete category "${categoryName}" because it is being used by one or more products. Please reassign or delete those products first.`,
          });
        }

        // Step 4: Delete the category (no products are using it)
        const result = (await supabaseAdmin
          .from("categories")
          .delete()
          .eq("id", input.categoryId)
          .eq("user_id", input.userId) // Ensure user owns this category
          .select()
          .single()) as {
          data: {
            id: string;
          } | null;
          error: SupabaseError | null;
        };

        const data = result.data;
        const error = result.error;

        if (error) {
          console.error("[Settings deleteCategory Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete category",
          });
        }

        if (!data) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Category not found or you don't have permission to delete it",
          });
        }

        return { success: true };
      } catch (error) {
        console.error("[Settings deleteCategory Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete category",
        });
      }
    }),
});
