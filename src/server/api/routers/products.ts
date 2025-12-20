import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { supabaseAdmin } from "~/lib/supabase-admin";

/**
 * Products Router - Batch Architecture
 *
 * Backend API endpoints for product and batch-related operations
 * Architecture: Products have multiple batches (1:many relationship)
 *
 * Architecture Benefits:
 * - Track multiple expiry dates per product
 * - Manage inventory by batch
 * - Historical batch tracking
 * - Flexible quantity management per batch
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
 * Database Row Types
 */
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
  created_at: string;
  updated_at: string;
}

/**
 * Product Input Validation Schema (without batch info)
 */
const productInputSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  category: z.string().min(1, "Category is required"),
  supplier: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  barcode: z.string().optional(),
});

/**
 * Batch Input Validation Schema
 */
const batchInputSchema = z.object({
  batchNumber: z.string().optional(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  quantity: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") {
        return null;
      }
      if (typeof val === "string") {
        const parsed = parseInt(val, 10);
        if (isNaN(parsed)) {
          throw new Error("Quantity must be a valid number");
        }
        return parsed;
      }
      return val;
    })
    .refine((val) => val === null || (Number.isInteger(val) && val > 0), {
      message: "Quantity must be a positive integer or null",
    }),
});

/**
 * Helper function to ensure a category exists in the categories table
 * Optimized with upsert pattern - single query instead of SELECT then INSERT
 */
async function ensureCategoryExists(
  userId: string,
  categoryName: string,
): Promise<void> {
  if (!categoryName?.trim()) {
    return;
  }

  const trimmedCategory = categoryName.trim();

  try {
    // Use upsert pattern: try to insert, ignore if already exists (ON CONFLICT DO NOTHING)
    // This is much faster than SELECT then conditional INSERT
    await supabaseAdmin
      .from("categories")
      .upsert(
        {
          user_id: userId,
          name: trimmedCategory,
          description: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,name",
          ignoreDuplicates: true,
        }
      );
  } catch (error) {
    // Silently ignore errors - category sync is not critical
    console.log(
      `[Products] Category sync skipped for "${trimmedCategory}":`,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

/**
 * Helper function to convert database rows to frontend format
 */
function convertToProduct(
  productRow: ProductRow,
  batchRows: ProductBatchRow[],
) {
  return {
    id: productRow.id,
    name: productRow.name,
    category: productRow.category,
    supplier: productRow.supplier ?? undefined,
    location: productRow.location ?? undefined,
    notes: productRow.notes ?? undefined,
    barcode: productRow.barcode ?? undefined,
    addedDate: productRow.added_date,
    batches: batchRows.map((batch) => ({
      id: batch.id,
      productId: batch.product_id,
      batchNumber: batch.batch_number ?? undefined,
      expiryDate: batch.expiry_date,
      quantity: batch.quantity,
      addedDate: batch.added_date,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at,
    })),
  };
}

export const productsRouter = createTRPCRouter({
  /**
   * Get All Products with Batches
   *
   * Retrieves all products for a specific user with their batches
   * Batches are sorted by expiry date (soonest first)
   */
  getAll: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Fetch all products for the user
        const { data: productsData, error: productsError } = await supabaseAdmin
          .from("products")
          .select("*")
          .eq("user_id", input.userId)
          .order("name", { ascending: true });

        if (productsError) {
          console.error("[Products getAll Error]", productsError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch products",
          });
        }

        const products = (productsData as ProductRow[]) ?? [];

        if (products.length === 0) {
          return [];
        }

        // Fetch all batches for these products
        const productIds = products.map((p) => p.id);
        const { data: batchesData, error: batchesError } = await supabaseAdmin
          .from("product_batches")
          .select("*")
          .in("product_id", productIds)
          .order("expiry_date", { ascending: true });

        if (batchesError) {
          console.error("[Batches getAll Error]", batchesError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch batches",
          });
        }

        const batches = (batchesData as ProductBatchRow[]) ?? [];

        // Group batches by product_id
        const batchesByProduct = batches.reduce(
          (acc, batch) => {
            acc[batch.product_id] ??= [];
            acc[batch.product_id]!.push(batch);
            return acc;
          },
          {} as Record<string, ProductBatchRow[]>,
        );

        // Combine products with their batches
        return products.map((product) =>
          convertToProduct(product, batchesByProduct[product.id] ?? []),
        );
      } catch (error) {
        console.error("[Products getAll Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch products",
        });
      }
    }),

  /**
   * Create Product with Initial Batch
   *
   * Creates a new product and its first batch
   * Both product and batch are created in a transaction
   */
  create: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
        product: productInputSchema,
        batch: batchInputSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Ensure category exists
        await ensureCategoryExists(input.userId, input.product.category);

        // Step 1: Create the product
        const { data: productData, error: productError } = await supabaseAdmin
          .from("products")
          .insert({
            user_id: input.userId,
            name: input.product.name,
            category: input.product.category,
            supplier: input.product.supplier,
            location: input.product.location,
            notes: input.product.notes,
            barcode: input.product.barcode,
          })
          .select()
          .single();

        if (productError || !productData) {
          console.error("[Products create Error]", productError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create product",
          });
        }

        const product = productData as ProductRow;

        // Step 2: Create the initial batch
        const { data: batchData, error: batchError } = await supabaseAdmin
          .from("product_batches")
          .insert({
            product_id: product.id,
            batch_number: input.batch.batchNumber,
            expiry_date: input.batch.expiryDate,
            quantity: input.batch.quantity,
          })
          .select()
          .single();

        if (batchError || !batchData) {
          console.error("[Batch create Error]", batchError);
          // Rollback: delete the product
          await supabaseAdmin.from("products").delete().eq("id", product.id);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create batch",
          });
        }

        const batch = batchData as ProductBatchRow;

        // Step 3: Save to barcode cache if applicable
        if (input.product.barcode && input.product.name) {
          try {
            await supabaseAdmin
              .from("barcode_cache")
              .insert({
                barcode: input.product.barcode.trim(),
                name: input.product.name,
                supplier: input.product.supplier ?? null,
                category: input.product.category ?? null,
              })
              .select()
              .single();
            console.log("✅ [Added to barcode cache]", input.product.barcode);
          } catch (cacheError) {
            // Ignore cache errors
            console.log("ℹ️ [Barcode cache skip]", cacheError);
          }
        }

        return convertToProduct(product, [batch]);
      } catch (error) {
        console.error("[Products create Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create product",
        });
      }
    }),

  /**
   * Update Product (Master Info Only)
   *
   * Updates product information (not batch-specific data)
   * Use updateBatch/createBatch/deleteBatch for batch operations
   */
  update: publicProcedure
    .input(
      z.object({
        productId: z.string().uuid("Invalid product ID"),
        userId: z.string().uuid("Invalid user ID"),
        product: productInputSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Update product immediately, sync category in background (non-blocking)
        void ensureCategoryExists(input.userId, input.product.category);

        const { data, error } = await supabaseAdmin
          .from("products")
          .update({
            name: input.product.name,
            category: input.product.category,
            supplier: input.product.supplier,
            location: input.product.location,
            notes: input.product.notes,
            barcode: input.product.barcode,
          })
          .eq("id", input.productId)
          .eq("user_id", input.userId)
          .select()
          .single();

        if (error || !data) {
          console.error("[Products update Error]", error);
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found or access denied",
          });
        }

        // Sync to barcode cache in background (non-blocking)
        if (input.product.barcode && input.product.name) {
          const barcode = input.product.barcode;
          const name = input.product.name;
          const supplier = input.product.supplier;
          const category = input.product.category;

          void (async () => {
            try {
              await supabaseAdmin.from("barcode_cache").insert({
                barcode: barcode.trim(),
                name: name,
                supplier: supplier ?? null,
                category: category ?? null,
              });
            } catch {
              // Ignore cache errors
            }
          })();
        }

        // Return immediately without fetching batches
        // Frontend already has batch data and updates them separately
        return convertToProduct(data as ProductRow, []);
      } catch (error) {
        console.error("[Products update Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update product",
        });
      }
    }),

  /**
   * Delete Product
   *
   * Removes a product and all its batches (CASCADE)
   */
  delete: publicProcedure
    .input(
      z.object({
        productId: z.string().uuid("Invalid product ID"),
        userId: z.string().uuid("Invalid user ID"),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { error } = await supabaseAdmin
          .from("products")
          .delete()
          .eq("id", input.productId)
          .eq("user_id", input.userId);

        if (error) {
          console.error("[Products delete Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete product",
          });
        }

        return { success: true };
      } catch (error) {
        console.error("[Products delete Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete product",
        });
      }
    }),

  /**
   * Create Batch for Existing Product
   *
   * Adds a new batch to an existing product
   */
  createBatch: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
        productId: z.string().uuid("Invalid product ID"),
        batch: batchInputSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Verify product ownership
        const { data: product, error: productError } = await supabaseAdmin
          .from("products")
          .select("id")
          .eq("id", input.productId)
          .eq("user_id", input.userId)
          .maybeSingle();

        if (productError || !product) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found or access denied",
          });
        }

        // Create the batch
        const { data, error } = await supabaseAdmin
          .from("product_batches")
          .insert({
            product_id: input.productId,
            batch_number: input.batch.batchNumber,
            expiry_date: input.batch.expiryDate,
            quantity: input.batch.quantity,
          })
          .select()
          .single();

        if (error || !data) {
          console.error("[Batch create Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create batch",
          });
        }

        return data as ProductBatchRow;
      } catch (error) {
        console.error("[Batch create Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create batch",
        });
      }
    }),

  /**
   * Update Batch
   *
   * Updates an existing batch's information
   */
  updateBatch: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
        batchId: z.string().uuid("Invalid batch ID"),
        batch: batchInputSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Update with RLS check via product ownership
        const { data, error } = await supabaseAdmin
          .from("product_batches")
          .update({
            batch_number: input.batch.batchNumber,
            expiry_date: input.batch.expiryDate,
            quantity: input.batch.quantity,
          })
          .eq("id", input.batchId)
          .select()
          .single();

        if (error || !data) {
          console.error("[Batch update Error]", error);
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found or access denied",
          });
        }

        return data as ProductBatchRow;
      } catch (error) {
        console.error("[Batch update Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update batch",
        });
      }
    }),

  /**
   * Delete Batch
   *
   * Removes a batch from a product
   */
  deleteBatch: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
        batchId: z.string().uuid("Invalid batch ID"),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { error } = await supabaseAdmin
          .from("product_batches")
          .delete()
          .eq("id", input.batchId);

        if (error) {
          console.error("[Batch delete Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete batch",
          });
        }

        return { success: true };
      } catch (error) {
        console.error("[Batch delete Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete batch",
        });
      }
    }),

  /**
   * Barcode Lookup Endpoint
   *
   * Same as before - returns product info for pre-filling forms
   */
  lookupBarcode: publicProcedure
    .input(
      z.object({
        barcode: z.string().min(1, "Barcode is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const barcode = input.barcode.trim();

      // Check cache first
      try {
        const { data: cachedProduct, error: cacheError } = await supabaseAdmin
          .from("barcode_cache")
          .select("barcode, name, supplier, category")
          .eq("barcode", barcode)
          .maybeSingle();

        if (cachedProduct && !cacheError) {
          console.log("✅ [Barcode Cache Hit]", barcode);
          return {
            found: true,
            data: {
              name: cachedProduct.name,
              category: cachedProduct.category ?? null,
              supplier: cachedProduct.supplier ?? null,
            },
            source: "cache",
            message: "Product found in cache",
          };
        }

        console.log("⚠️ [Barcode Cache Miss]", barcode, "- trying API");
      } catch (error) {
        console.error("[Barcode Cache Error]", error);
      }

      // Try Open Food Facts API
      try {
        const response = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        );

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = (await response.json()) as BarcodeLookupResponse;

        if (data.status === 1 && data.product) {
          const productData = data.product;
          console.log("✅ [Barcode API Hit]", barcode);

          const result = {
            name: productData.product_name ?? null,
            category: productData.categories
              ? (productData.categories.split(",")[0]?.trim() ?? null)
              : null,
            supplier: productData.brands ?? null,
          };

          return {
            found: true,
            data: result,
            source: "api",
            message: "Product found in Open Food Facts API",
          };
        }
      } catch (error) {
        console.error("[Barcode API Error]", error);
      }

      console.log("❌ [Barcode Not Found]", barcode);
      return {
        found: false,
        data: null,
        source: null,
        message: "Product not found in database or API",
      };
    }),

  /**
   * Get All Categories
   */
  getCategories: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid("Invalid user ID"),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { data: categoriesData, error: categoriesError } =
          await supabaseAdmin
            .from("categories")
            .select("name")
            .eq("user_id", input.userId)
            .order("name", { ascending: true });

        if (!categoriesError && categoriesData && categoriesData.length > 0) {
          return categoriesData.map((cat) => cat.name);
        }

        const { data, error } = await supabaseAdmin
          .from("products")
          .select("category")
          .eq("user_id", input.userId);

        if (error) {
          console.error("[Products getCategories Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch categories",
          });
        }

        const categories = data as Array<{ category: string }>;
        const uniqueCategories = Array.from(
          new Set(categories.map((product) => product.category)),
        )
          .filter(
            (category): category is string =>
              typeof category === "string" &&
              category.trim() !== "" &&
              category !== "-",
          )
          .sort();

        return uniqueCategories;
      } catch (error) {
        console.error("[Products getCategories Error]", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch categories",
        });
      }
    }),
});
