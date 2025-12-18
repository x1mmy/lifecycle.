import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { supabaseAdmin } from "~/lib/supabase-admin";
import type { AdminUserWithStats, AdminUserProduct, AdminUserProductBatch, AdminStats } from "~/types";
import { getExpiryStatus } from "~/utils/dateUtils";

/**
 * Admin Router - Batch Architecture
 *
 * Backend API endpoints for admin-specific operations
 * Handles user management, system monitoring, and oversight functions
 * Updated to work with product_batches architecture
 *
 * Security: All endpoints should verify admin role before execution
 */

/**
 * Database Types
 */
interface ProfileRow {
  id: string;
  business_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  created_at: string;
  is_active: boolean;
}

interface ProductRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  supplier?: string | null;
  location?: string | null;
  notes?: string | null;
  barcode?: string | null;
  added_date: string;
}

interface ProductBatchRow {
  id: string;
  product_id: string;
  batch_number?: string | null;
  expiry_date: string;
  quantity: number | null;
  added_date: string;
}

export const adminRouter = createTRPCRouter({
  /**
   * Get All Users With Statistics
   *
   * Retrieves all users with their product counts and last login information
   * Now counts products and active batches separately
   *
   * @returns Array of users with stats
   */
  getAllUsersWithStats: publicProcedure
    .query(async (): Promise<AdminUserWithStats[]> => {
      try {
        // Get all profiles
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profilesError) {
          console.error('[Admin getAllUsersWithStats - Profiles Error]', profilesError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch user profiles',
          });
        }

        if (!profiles || profiles.length === 0) {
          return [];
        }

        // Get auth data for last sign in times
        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

        if (authError) {
          console.error('[Admin getAllUsersWithStats - Auth Error]', authError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch authentication data',
          });
        }

        // Create a map of user_id -> last_sign_in_at
        const authMap = new Map<string, string | undefined>();
        authUsers.users.forEach((user) => {
          authMap.set(user.id, user.last_sign_in_at ?? undefined);
        });

        // Get product counts for all users
        const today = new Date().toISOString().split('T')[0];

        const usersWithStats: AdminUserWithStats[] = await Promise.all(
          profiles.map(async (profile: ProfileRow) => {
            // Get total products count (unique products, not batches)
            const { count: totalCount, error: totalError } = await supabaseAdmin
              .from('products')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', profile.id);

            if (totalError) {
              console.error('[Admin getAllUsersWithStats - Total Count Error]', totalError);
            }

            // Get active (non-expired) batches count
            // Join products with batches to filter by user and expiry date
            const { data: activeProductIds, error: activeError } = await supabaseAdmin
              .from('products')
              .select('id')
              .eq('user_id', profile.id);

            let activeBatchesCount = 0;
            if (!activeError && activeProductIds && activeProductIds.length > 0) {
              const productIds = activeProductIds.map((p: { id: string }) => p.id);
              const { count: batchCount } = await supabaseAdmin
                .from('product_batches')
                .select('*', { count: 'exact', head: true })
                .in('product_id', productIds)
                .gte('expiry_date', today!);

              activeBatchesCount = batchCount ?? 0;
            }

            return {
              id: profile.id,
              business_name: profile.business_name,
              email: profile.email,
              phone: profile.phone ?? undefined,
              address: profile.address ?? undefined,
              created_at: profile.created_at,
              is_active: profile.is_active,
              last_sign_in_at: authMap.get(profile.id),
              total_products: totalCount ?? 0,
              active_products: activeBatchesCount, // Now represents active batches
            };
          })
        );

        return usersWithStats;
      } catch (error) {
        console.error('[Admin getAllUsersWithStats Error]', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch users with statistics',
        });
      }
    }),

  /**
   * Get User Products with Batches
   *
   * Retrieves all products and their batches for a specific user
   * Used in the user details modal
   *
   * @input userId - The user's ID
   * @returns Array of products with their batches
   */
  getUserProducts: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
      })
    )
    .query(async ({ input }): Promise<AdminUserProduct[]> => {
      try {
        // Fetch products
        const { data: products, error: productsError } = await supabaseAdmin
          .from('products')
          .select('*')
          .eq('user_id', input.userId)
          .order('name', { ascending: true });

        if (productsError) {
          console.error('[Admin getUserProducts Error]', productsError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch user products',
          });
        }

        if (!products || products.length === 0) {
          return [];
        }

        const productRows = products as ProductRow[];
        const productIds = productRows.map(p => p.id);

        // Fetch batches for these products
        const { data: batches, error: batchesError } = await supabaseAdmin
          .from('product_batches')
          .select('*')
          .in('product_id', productIds)
          .order('expiry_date', { ascending: true });

        if (batchesError) {
          console.error('[Admin getUserProducts - Batches Error]', batchesError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch product batches',
          });
        }

        const batchRows = (batches as ProductBatchRow[]) ?? [];

        // Group batches by product_id
        const batchesByProduct = batchRows.reduce(
          (acc, batch) => {
            acc[batch.product_id] ??= [];
            acc[batch.product_id]!.push(batch);
            return acc;
          },
          {} as Record<string, ProductBatchRow[]>
        );

        // Combine products with their batches
        const productsWithBatches: AdminUserProduct[] = productRows.map((product) => {
          const productBatches = batchesByProduct[product.id] ?? [];

          return {
            id: product.id,
            name: product.name,
            category: product.category,
            supplier: product.supplier ?? undefined,
            location: product.location ?? undefined,
            notes: product.notes ?? undefined,
            barcode: product.barcode ?? undefined,
            added_date: product.added_date,
            batches: productBatches.map(batch => ({
              id: batch.id,
              productId: batch.product_id,
              batchNumber: batch.batch_number ?? undefined,
              expiryDate: batch.expiry_date,
              quantity: batch.quantity,
              addedDate: batch.added_date,
              createdAt: batch.added_date, // Use added_date as fallback
              updatedAt: batch.added_date, // Use added_date as fallback
            })),
          };
        });

        return productsWithBatches;
      } catch (error) {
        console.error('[Admin getUserProducts Error]', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user products',
        });
      }
    }),

  /**
   * Get User Product Batches (Flattened View)
   *
   * Returns a flattened list of all batches with their product info
   * Useful for displaying batch-level data with expiry status
   *
   * @input userId - The user's ID
   * @returns Array of batches with product info and expiry status
   */
  getUserProductBatches: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
      })
    )
    .query(async ({ input }): Promise<AdminUserProductBatch[]> => {
      try {
        // Fetch products
        const { data: products, error: productsError } = await supabaseAdmin
          .from('products')
          .select('*')
          .eq('user_id', input.userId);

        if (productsError) {
          console.error('[Admin getUserProductBatches Error]', productsError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch user products',
          });
        }

        if (!products || products.length === 0) {
          return [];
        }

        const productRows = products as ProductRow[];
        const productIds = productRows.map(p => p.id);

        // Fetch batches
        const { data: batches, error: batchesError } = await supabaseAdmin
          .from('product_batches')
          .select('*')
          .in('product_id', productIds)
          .order('expiry_date', { ascending: true });

        if (batchesError) {
          console.error('[Admin getUserProductBatches - Batches Error]', batchesError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch product batches',
          });
        }

        const batchRows = (batches as ProductBatchRow[]) ?? [];

        // Add expiry status to each batch
        const batchesWithStatus: AdminUserProductBatch[] = batchRows.map((batch) => ({
          id: batch.id,
          product_id: batch.product_id,
          batch_number: batch.batch_number ?? undefined,
          expiry_date: batch.expiry_date,
          quantity: batch.quantity,
          added_date: batch.added_date,
          status: getExpiryStatus(batch.expiry_date),
        }));

        return batchesWithStatus;
      } catch (error) {
        console.error('[Admin getUserProductBatches Error]', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user product batches',
        });
      }
    }),

  /**
   * Toggle User Status
   *
   * Activates or deactivates a user account
   * When deactivated, user cannot log in
   *
   * @input userId - The user's ID
   * @input isActive - New active status
   * @returns Success status
   */
  toggleUserStatus: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ is_active: input.isActive })
          .eq('id', input.userId);

        if (error) {
          console.error('[Admin toggleUserStatus Error]', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update user status',
          });
        }

        return {
          success: true,
          message: `User ${input.isActive ? 'activated' : 'deactivated'} successfully`,
        };
      } catch (error) {
        console.error('[Admin toggleUserStatus Error]', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user status',
        });
      }
    }),

  /**
   * Get Admin Stats
   *
   * Retrieves high-level statistics for the admin dashboard
   * Updated to count batches instead of products for "active" metric
   *
   * @returns Admin statistics object
   */
  getAdminStats: publicProcedure
    .query(async (): Promise<AdminStats> => {
      try {
        const today = new Date().toISOString().split('T')[0];

        // Get total users
        const { count: totalUsers, error: usersError } = await supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (usersError) {
          console.error('[Admin getAdminStats - Users Error]', usersError);
        }

        // Get total products (unique products, not batches)
        const { count: totalProducts, error: productsError } = await supabaseAdmin
          .from('products')
          .select('*', { count: 'exact', head: true });

        if (productsError) {
          console.error('[Admin getAdminStats - Products Error]', productsError);
        }

        // Get users with active batches (products with non-expired batches)
        const { data: allProducts, error: allProductsError } = await supabaseAdmin
          .from('products')
          .select('id, user_id');

        if (allProductsError) {
          console.error('[Admin getAdminStats - All Products Error]', allProductsError);
        }

        let uniqueUsersWithActiveProducts = 0;

        if (allProducts && allProducts.length > 0) {
          const productIds = allProducts.map((p: { id: string }) => p.id);

          const { data: activeBatches, error: activeBatchesError } = await supabaseAdmin
            .from('product_batches')
            .select('product_id')
            .in('product_id', productIds)
            .gte('expiry_date', today!);

          if (activeBatchesError) {
            console.error('[Admin getAdminStats - Active Batches Error]', activeBatchesError);
          }

          if (activeBatches && activeBatches.length > 0) {
            // Get unique product IDs with active batches
            const activeProductIds = new Set(
              activeBatches.map((b: { product_id: string }) => b.product_id)
            );

            // Map these back to user IDs
            const usersWithActiveBatches = new Set(
              allProducts
                .filter((p: { id: string }) => activeProductIds.has(p.id))
                .map((p: { user_id: string }) => p.user_id)
            );

            uniqueUsersWithActiveProducts = usersWithActiveBatches.size;
          }
        }

        return {
          totalUsers: totalUsers ?? 0,
          totalProducts: totalProducts ?? 0,
          usersWithActiveProducts: uniqueUsersWithActiveProducts,
        };
      } catch (error) {
        console.error('[Admin getAdminStats Error]', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch admin statistics',
        });
      }
    }),
});
