# Product Batches Architecture Implementation

## Overview
This document tracks the implementation of the new product batches architecture, which enables a single product to have multiple expiry dates and batch numbers.

## Architecture Change

### Before (1:1 Relationship)
```
products table:
- id
- name
- category
- expiry_date        ← Single expiry per product
- batch_number       ← Single batch per product
- quantity           ← Single quantity per product
```

### After (1:Many Relationship)
```
products table (master product info):
- id
- name
- category
- supplier
- location
- barcode
- notes
(expiry_date, batch_number, quantity removed)

product_batches table (NEW):
- id
- product_id         ← Links to products table
- batch_number
- expiry_date
- quantity
- added_date
```

## Implementation Status

### ✅ COMPLETED: Backend Infrastructure

#### 1. Database Migrations
- ✅ [20250118000001_create_product_batches.sql](supabase/migrations/20250118000001_create_product_batches.sql)
  - Creates `product_batches` table
  - Sets up RLS policies (inherits from parent product)
  - Removes batch-specific columns from `products` table
  - Creates indexes for performance

- ✅ [20250118000002_migrate_existing_products_to_batches.sql](supabase/migrations/20250118000002_migrate_existing_products_to_batches.sql)
  - Migrates existing product data to batches
  - Each existing product becomes product + one batch
  - Preserves all expiry dates and batch numbers

#### 2. TypeScript Types
- ✅ Updated [src/types/index.ts](src/types/index.ts)
  - `Product` interface now includes `batches?: ProductBatch[]`
  - New `ProductBatch` interface
  - Updated `AdminUserProduct` and `AdminUserProductBatch`

#### 3. tRPC API Routers
- ✅ Updated [src/server/api/routers/products.ts](src/server/api/routers/products.ts)
  - **getAll()** - Fetches products with their batches
  - **create()** - Creates product + initial batch
  - **update()** - Updates product master info only
  - **delete()** - Deletes product + all batches (CASCADE)
  - **createBatch()** - NEW: Add batch to existing product
  - **updateBatch()** - NEW: Update existing batch
  - **deleteBatch()** - NEW: Remove batch from product
  - **lookupBarcode()** - Unchanged (still works)
  - **getCategories()** - Unchanged (still works)

- ✅ Updated [src/server/api/routers/admin.ts](src/server/api/routers/admin.ts)
  - **getAllUsersWithStats()** - Now counts active batches
  - **getUserProducts()** - Returns products with batches
  - **getUserProductBatches()** - NEW: Returns flattened batch list
  - **getAdminStats()** - Updated to count batches correctly

### 🚧 TODO: Frontend Updates

#### 4. Email Cron Jobs
- ⏳ [src/app/api/cron/daily-summary/route.ts](src/app/api/cron/daily-summary/route.ts)
  - Update to query `product_batches` instead of `products.expiry_date`
  - Join products with batches to get expiring items

- ⏳ [src/app/api/cron/weekly-report/route.ts](src/app/api/cron/weekly-report/route.ts)
  - Update to aggregate batch data
  - Count total batches, expired batches, expiring soon batches

#### 5. Dashboard Page
- ⏳ [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)
  - Update statistics calculation to aggregate batch data
  - "Total Products" → Count unique products
  - "Expiring Soon" → Count batches expiring within threshold
  - "Expired" → Count batches past expiry date
  - Update product cards to show batch information
  - Allow batch-level actions (delete individual batches)

#### 6. Products Page
- ⏳ [src/app/products/page.tsx](src/app/products/page.tsx)
  - Display products with expandable batch lists
  - Show all batches for each product
  - Update filtering to work with batch expiry dates
  - Update sorting to consider earliest batch expiry
  - Batch management UI:
    - "Add Batch" button for each product
    - Edit/delete individual batches
    - Visual indicators for batch status

#### 7. Product Forms
- ⏳ [src/components/products/AddProductForm.tsx](src/components/products/AddProductForm.tsx) or similar
  - When creating product, also create first batch
  - Form should have:
    - Product fields: name, category, supplier, location, barcode, notes
    - Batch fields: batch number, expiry date, quantity
  - Use `api.products.create.useMutation()` with both product and batch data

- ⏳ NEW: Create `BatchManagementModal.tsx`
  - Modal for adding/editing batches to existing products
  - Form with: batch number, expiry date, quantity
  - List of existing batches with edit/delete actions
  - Use `api.products.createBatch`, `updateBatch`, `deleteBatch` mutations

#### 8. Admin Dashboard
- ⏳ [src/app/admin/page.tsx](src/app/admin/page.tsx)
  - Update user details modal to show batches
  - Display products with their batches
  - Show batch-level expiry status

#### 9. Other Components to Update
- ⏳ [src/components/dashboard/ProductAlert.tsx](src/components/dashboard/ProductAlert.tsx)
  - Update to handle products with multiple batches
  - Show which batch is expiring

- ⏳ [src/components/dashboard/QuantityUpdateModal.tsx](src/components/dashboard/QuantityUpdateModal.tsx)
  - Update quantity for specific batch, not product
  - Allow selecting which batch to update

- ⏳ [src/components/products/BarcodeScannerModal.tsx](src/components/products/BarcodeScannerModal.tsx)
  - After barcode scan, create product + first batch
  - Form should include batch fields

## API Usage Examples

### Creating a Product with Initial Batch
```typescript
const createMutation = api.products.create.useMutation({
  onSuccess: () => {
    toast.success("Product and batch created!");
  }
});

createMutation.mutate({
  userId: user.id,
  product: {
    name: "Organic Milk",
    category: "Dairy",
    supplier: "Farm Fresh",
    location: "Warehouse A",
    barcode: "123456789",
    notes: "Keep refrigerated"
  },
  batch: {
    batchNumber: "B2025-001",
    expiryDate: "2025-02-15",
    quantity: 50
  }
});
```

### Adding a New Batch to Existing Product
```typescript
const createBatchMutation = api.products.createBatch.useMutation({
  onSuccess: () => {
    toast.success("Batch added!");
  }
});

createBatchMutation.mutate({
  userId: user.id,
  productId: "product-uuid-here",
  batch: {
    batchNumber: "B2025-002",
    expiryDate: "2025-03-20",
    quantity: 30
  }
});
```

### Updating a Batch
```typescript
const updateBatchMutation = api.products.updateBatch.useMutation({
  onSuccess: () => {
    toast.success("Batch updated!");
  }
});

updateBatchMutation.mutate({
  userId: user.id,
  batchId: "batch-uuid-here",
  batch: {
    batchNumber: "B2025-002-REVISED",
    expiryDate: "2025-03-25",
    quantity: 25
  }
});
```

### Deleting a Batch
```typescript
const deleteBatchMutation = api.products.deleteBatch.useMutation({
  onSuccess: () => {
    toast.success("Batch deleted!");
  }
});

deleteBatchMutation.mutate({
  userId: user.id,
  batchId: "batch-uuid-here"
});
```

### Fetching Products with Batches
```typescript
const { data: products } = api.products.getAll.useQuery({
  userId: user.id
});

// products is now:
// [
//   {
//     id: "product-1",
//     name: "Organic Milk",
//     category: "Dairy",
//     batches: [
//       { id: "batch-1", expiryDate: "2025-02-15", quantity: 50 },
//       { id: "batch-2", expiryDate: "2025-03-20", quantity: 30 }
//     ]
//   }
// ]
```

## Migration Steps

### To Apply These Changes:

1. **Run Database Migrations** (in order):
   ```bash
   # Apply migrations through Supabase CLI or dashboard
   # Migrations will:
   # - Create product_batches table
   # - Migrate existing data
   # - Remove old columns from products table
   ```

2. **Deploy Backend Changes**:
   - Updated tRPC routers are backward-compatible during transition
   - No downtime required

3. **Update Frontend Components** (do in this order):
   - Email cron jobs (so notifications work correctly)
   - Dashboard (so users see correct data)
   - Products page (so users can manage batches)
   - Forms (so users can create new batches)
   - Admin dashboard (so admins see correct data)

4. **Test Thoroughly**:
   - Create new product with batch
   - Add additional batches to existing product
   - Update batch details
   - Delete individual batches
   - Delete products (verify CASCADE deletes batches)
   - Check dashboard statistics
   - Test email notifications
   - Verify admin dashboard

## Benefits of This Architecture

1. **Multiple Expiry Tracking**: Same product, different batches with different expiry dates
2. **Historical Records**: Keep batch history even after depletion
3. **Better Inventory Management**: Know exactly which batch expires when
4. **Flexible Quantity Tracking**: Each batch has its own quantity
5. **FIFO Implementation**: Easy to implement First-In-First-Out logic
6. **Reporting**: Better insights into inventory turnover by batch

## Rollback Plan

If needed to rollback:
1. Create reverse migration that:
   - Adds back `expiry_date`, `batch_number`, `quantity` to products table
   - Copies earliest batch data back to product row
   - Drops `product_batches` table
2. Revert code changes to previous commit

## Notes

- RLS policies ensure users can only access their own batches
- CASCADE delete ensures deleting a product removes all its batches
- Barcode cache still works (product-level, not batch-level)
- Categories are still product-level (not batch-specific)
- All migrations preserve existing data
