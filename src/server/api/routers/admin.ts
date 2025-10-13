import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { supabaseAdmin } from "~/lib/supabase-admin";
import type { AdminUserWithStats, AdminUserProduct, AdminStats } from "~/types";
import { getExpiryStatus } from "~/utils/dateUtils";

/**
 * Admin Router
 * 
 * Backend API endpoints for admin-specific operations
 * Handles user management, system monitoring, and oversight functions
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
  expiry_date: string;
  quantity: number;
  batch_number?: string | null;
  supplier?: string | null;
  location?: string | null;
  notes?: string | null;
  barcode?: string | null;
  added_date: string;
}

export const adminRouter = createTRPCRouter({
  /**
   * Get All Users With Statistics
   * 
   * Retrieves all users with their product counts and last login information
   * Used by admin dashboard to display user list
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
            // Get total products count
            const { count: totalCount, error: totalError } = await supabaseAdmin
              .from('products')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', profile.id);

            if (totalError) {
              console.error('[Admin getAllUsersWithStats - Total Count Error]', totalError);
            }

            // Get active (non-expired) products count
            const { count: activeCount, error: activeError } = await supabaseAdmin
              .from('products')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', profile.id)
              .gte('expiry_date', today);

            if (activeError) {
              console.error('[Admin getAllUsersWithStats - Active Count Error]', activeError);
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
              active_products: activeCount ?? 0,
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
   * Get User Products
   * 
   * Retrieves all products for a specific user
   * Used in the user details modal
   * 
   * @input userId - The user's ID
   * @returns Array of products with expiry status
   */
  getUserProducts: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
      })
    )
    .query(async ({ input }): Promise<AdminUserProduct[]> => {
      try {
        const { data: products, error } = await supabaseAdmin
          .from('products')
          .select('*')
          .eq('user_id', input.userId)
          .order('expiry_date', { ascending: true });

        if (error) {
          console.error('[Admin getUserProducts Error]', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch user products',
          });
        }

        // Add expiry status to each product
        const productsWithStatus: AdminUserProduct[] = (products as ProductRow[] ?? []).map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category,
          expiry_date: product.expiry_date,
          quantity: product.quantity,
          batch_number: product.batch_number ?? undefined,
          supplier: product.supplier ?? undefined,
          location: product.location ?? undefined,
          notes: product.notes ?? undefined,
          barcode: product.barcode ?? undefined,
          added_date: product.added_date,
          status: getExpiryStatus(product.expiry_date),
        }));

        return productsWithStatus;
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

        // Get total products
        const { count: totalProducts, error: productsError } = await supabaseAdmin
          .from('products')
          .select('*', { count: 'exact', head: true });

        if (productsError) {
          console.error('[Admin getAdminStats - Products Error]', productsError);
        }

        // Get users with active products (subquery to count distinct user_ids)
        const { data: usersWithProducts, error: activeUsersError } = await supabaseAdmin
          .from('products')
          .select('user_id')
          .gte('expiry_date', today);

        if (activeUsersError) {
          console.error('[Admin getAdminStats - Active Users Error]', activeUsersError);
        }

        const uniqueUsersWithActiveProducts = new Set(
          usersWithProducts?.map((p: { user_id: string }) => p.user_id) ?? []
        ).size;

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

