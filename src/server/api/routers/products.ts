import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { supabase } from "~/lib/supabase";

/**
 * Products Router
 * 
 * Backend API endpoints for product-related operations
 * Handles all CRUD operations and business logic server-side
 * 
 * Architecture Benefits:
 * - Frontend is purely UI/presentation
 * - Business logic centralized in backend
 * - Consistent error handling
 * - Type-safe with Zod validation
 */

/**
 * Barcode Lookup Response Type
 * Data structure returned from Open Food Facts API
 */
interface BarcodeProductData {
  product_name?: string;
  categories?: string;
  brands?: string;
}

interface BarcodeLookupResponse {
  status: number;
  product?: BarcodeProductData;
}

/**
 * Database Product Row Type
 * Matches the Supabase products table schema
 */
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

/**
 * Product Input Validation Schema
 * Validates all product fields before database operations
 */
const productInputSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  category: z.string().min(1, "Category is required"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  quantity: z.number().int().positive("Quantity must be a positive number"),
  batchNumber: z.string().optional(),
  supplier: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export const productsRouter = createTRPCRouter({
  /**
   * Get All Products
   * 
   * Retrieves all products for a specific user
   * Sorted by expiry date (soonest first)
   * 
   * @input userId - The authenticated user's ID
   * @returns Array of products
   */
  getAll: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
      })
    )
    .query(async ({ input }) => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', input.userId)
          .order('expiry_date', { ascending: true });

        if (error) {
          console.error('[Products getAll Error]', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch products',
          });
        }

        return (data as ProductRow[]) ?? [];
      } catch (error) {
        console.error('[Products getAll Error]', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch products',
        });
      }
    }),

  /**
   * Create Product
   * 
   * Adds a new product to the database
   * Validates input and enforces business rules
   * 
   * @input userId - The authenticated user's ID
   * @input product data - All product fields
   * @returns Created product with ID
   */
  create: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
        product: productInputSchema,
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await supabase
          .from('products')
          .insert({
            user_id: input.userId,
            name: input.product.name,
            category: input.product.category,
            expiry_date: input.product.expiryDate,
            quantity: input.product.quantity,
            batch_number: input.product.batchNumber,
            supplier: input.product.supplier,
            location: input.product.location,
            notes: input.product.notes,
          })
          .select()
          .single();

        if (response.error) {
          console.error('[Products create Error]', response.error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create product',
          });
        }

        return response.data as ProductRow;
      } catch (error) {
        console.error('[Products create Error]', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create product',
        });
      }
    }),

  /**
   * Update Product
   * 
   * Updates an existing product
   * Validates input and checks ownership via RLS
   * 
   * @input productId - ID of product to update
   * @input userId - The authenticated user's ID
   * @input product data - Updated product fields
   * @returns Updated product
   */
  update: publicProcedure
    .input(
      z.object({
        productId: z.string().uuid("Invalid product ID"),
        userId: z.string().uuid("Invalid user ID"),
        product: productInputSchema,
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await supabase
          .from('products')
          .update({
            name: input.product.name,
            category: input.product.category,
            expiry_date: input.product.expiryDate,
            quantity: input.product.quantity,
            batch_number: input.product.batchNumber,
            supplier: input.product.supplier,
            location: input.product.location,
            notes: input.product.notes,
          })
          .eq('id', input.productId)
          .eq('user_id', input.userId) // RLS protection
          .select()
          .single();

        if (response.error) {
          console.error('[Products update Error]', response.error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update product',
          });
        }

        if (!response.data) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Product not found or access denied',
          });
        }

        return response.data as ProductRow;
      } catch (error) {
        console.error('[Products update Error]', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update product',
        });
      }
    }),

  /**
   * Delete Product
   * 
   * Removes a product from the database
   * Checks ownership via RLS
   * 
   * @input productId - ID of product to delete
   * @input userId - The authenticated user's ID
   * @returns Success status
   */
  delete: publicProcedure
    .input(
      z.object({
        productId: z.string().uuid("Invalid product ID"),
        userId: z.string().uuid("Invalid user ID"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', input.productId)
          .eq('user_id', input.userId); // RLS protection

        if (error) {
          console.error('[Products delete Error]', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete product',
          });
        }

        return { success: true };
      } catch (error) {
        console.error('[Products delete Error]', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete product',
        });
      }
    }),

  /**
   * Barcode Lookup Endpoint
   * 
   * Calls Open Food Facts API to retrieve product information
   * Server-side implementation provides:
   * - Better security (API calls not exposed to client)
   * - Centralized error handling
   * - Ability to add caching/rate limiting later
   * - Can easily switch to different barcode APIs
   * 
   * @input barcode - The product barcode/UPC to lookup
   * @returns Product information (name, category, supplier/brand)
   */
  lookupBarcode: publicProcedure
    .input(
      z.object({
        barcode: z.string().min(1, "Barcode is required"),
      })
    )
    .mutation(async ({ input }) => {
      const { barcode } = input;

      try {
        // Call Open Food Facts API
        const response = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${barcode.trim()}.json`
        );

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json() as BarcodeLookupResponse;

        // Check if product was found
        if (data.status !== 1 || !data.product) {
          return {
            found: false,
            data: null,
            message: "Product not found in database",
          };
        }

        const productData = data.product;

        // Extract and format product information
        const result = {
          name: productData.product_name ?? null,
          category: productData.categories
            ? productData.categories.split(',')[0]?.trim() ?? null
            : null,
          supplier: productData.brands ?? null,
        };

        return {
          found: true,
          data: result,
          message: "Product found successfully",
        };
      } catch (error) {
        // Log error on server for debugging
        console.error("[Barcode Lookup Error]", error);
        
        // Return user-friendly error
        return {
          found: false,
          data: null,
          message: "Failed to lookup barcode. Please try again or enter details manually.",
        };
      }
    }),
});

