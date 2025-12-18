# URGENT: Frontend Pages Need Batch Architecture Update

## ⚠️ CRITICAL - These pages are temporarily disabled to allow deployment

The database has been migrated to the batch architecture, but the frontend pages need updates.

### ✅ WORKING:
- Backend API (tRPC) - ✅ Fully functional with batch support
- Admin dashboard - ✅ Updated to show batches
- Email notifications - ✅ Working with batches
- Database - ✅ Migrated successfully

### 🚧 NEEDS UPDATE (Currently showing placeholder messages):
1. **Dashboard** (`src/app/dashboard/page.tsx`)
   - Currently queries Supabase directly (old method)
   - Needs to use tRPC API: `api.products.getAll.useQuery()`
   - Statistics calculations need to aggregate across batches
   - Status: Shows "temporarily disabled" message

2. **Products Page** (`src/app/products/page.tsx`)
   - Currently queries Supabase directly (old method)
   - Needs to use tRPC API
   - Needs UI to display batches per product
   - Needs forms to add/edit/delete batches
   - Status: TOO MANY ERRORS - temporarily using old code

## 🔧 Quick Fix to Get Products Page Working:

The products page still expects the old database structure. Options:

### Option A: Use tRPC API (RECOMMENDED)
Replace direct Supabase queries with:
```typescript
const { data: products } = api.products.getAll.useQuery({
  userId: user.id
});
```

### Option B: Temporary - Query both tables
Keep existing code but query both `products` and `product_batches`:
```typescript
// Get products
const { data: productsData } = await supabase
  .from('products')
  .select('*');

// Get batches
const { data: batchesData } = await supabase
  .from('product_batches')
  .select('*');

// Combine them
const products = productsData.map(p => ({
  ...p,
  batches: batchesData.filter(b => b.product_id === p.id)
}));
```

## 📋 Implementation Checklist

### Dashboard Page Updates:
- [ ] Replace Supabase direct query with `api.products.getAll.useQuery()`
- [ ] Update `expiringSoon` to check batches: `products.filter(p => (p.batches ?? []).some(b => isExpiringSoon(b.expiryDate)))`
- [ ] Update `expired` to check batches
- [ ] Update `categoryStats` to work with batches
- [ ] Update `upcomingExpirations` to flatten batches
- [ ] Update `ProductAlert` component to show batch info

### Products Page Updates:
- [ ] Replace Supabase direct query with tRPC
- [ ] Update table to show products with expandable batch rows
- [ ] Add "Add Batch" button per product
- [ ] Update filtering to work with batch dates
- [ ] Update sorting to use earliest batch
- [ ] Create BatchManagementModal component
- [ ] Update delete to handle batch deletion

### Forms:
- [ ] Update AddProductForm to include initial batch fields
- [ ] Use `api.products.create.useMutation()` with product + batch
- [ ] Create batch management UI

## 🚀 API Usage Examples

See `BATCH_IMPLEMENTATION.md` for complete API examples.

Quick reference:
```typescript
// Get all products with batches
const { data: products } = api.products.getAll.useQuery({ userId: user.id });

// Create product with first batch
api.products.create.useMutation({
  userId,
  product: {...},
  batch: { expiryDate, quantity, batchNumber }
});

// Add batch to existing product
api.products.createBatch.useMutation({
  userId,
  productId,
  batch: {...}
});
```

## Timeline Estimate
- Dashboard fix: 2-3 hours
- Products page fix: 4-6 hours
- Forms update: 2-3 hours
- Testing: 2 hours
**Total: ~1 working day**
