# Product Batches Implementation - Progress Report

## ✅ COMPLETED (Backend + Email System)

### Database Layer
- ✅ Created `product_batches` table migration
- ✅ Created data migration to convert existing products
- ✅ Set up RLS policies for batch security
- ✅ Configured CASCADE delete for cleanup

### TypeScript Types
- ✅ Updated `Product` interface to include `batches[]`
- ✅ Created `ProductBatch` interface
- ✅ Updated `AdminUserProduct` and `AdminUserProductBatch` types

### Backend API (tRPC)
- ✅ Products Router:
  - `getAll()` - Fetches products with batches
  - `create()` - Creates product + initial batch
  - `update()` - Updates product master info
  - `delete()` - Deletes product + all batches
  - `createBatch()` - NEW: Add batch to product
  - `updateBatch()` - NEW: Update batch
  - `deleteBatch()` - NEW: Remove batch
  - `lookupBarcode()` - Still works
  - `getCategories()` - Still works

- ✅ Admin Router:
  - `getAllUsersWithStats()` - Counts active batches
  - `getUserProducts()` - Returns products with batches
  - `getUserProductBatches()` - NEW: Flattened batch view
  - `getAdminStats()` - Updated for batch counting

### Email Notification System
- ✅ Daily Summary Cron ([src/app/api/cron/daily-summary/route.ts](src/app/api/cron/daily-summary/route.ts))
  - Updated to query `product_batches` table
  - Joins products with batches for expiring items
  - Email shows batch numbers correctly

- ✅ Weekly Report Cron ([src/app/api/cron/weekly-report/route.ts](src/app/api/cron/weekly-report/route.ts))
  - Updated to aggregate batch statistics
  - Counts unique products + batch expirations
  - Email templates already support batch display

### Documentation
- ✅ Created [BATCH_IMPLEMENTATION.md](BATCH_IMPLEMENTATION.md) with architecture guide
- ✅ Created this progress report

---

## 🚧 TODO (Frontend Components)

### Priority 1: Dashboard
**File:** [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)

**Changes Needed:**
- Update statistics calculation to aggregate across batches
- Change "Total Products" to count unique products
- Change "Expiring Soon" to count batches within threshold
- Change "Expired" to count batches past expiry date
- Update product cards to show multiple batches per product
- Allow batch-level actions (e.g., delete individual batch)

**Implementation Notes:**
```typescript
// Current: products.filter(p => isExpiring(p.expiryDate))
// New: products.flatMap(p => p.batches?.filter(b => isExpiring(b.expiryDate)) ?? [])

// Each product card should show:
// - Product name + category
// - List of batches with their expiry dates
// - Earliest batch determines urgency level
```

---

### Priority 2: Products Page
**File:** [src/app/products/page.tsx](src/app/products/page.tsx)

**Changes Needed:**
- Display products with expandable batch lists
- Show all batches for each product in table/cards
- Update filtering logic to work with batch expiry dates
- Update sorting to consider earliest batch expiry
- Add "Add Batch" button for each product
- Add edit/delete buttons for individual batches

**UI Design:**
```
Product: Organic Milk | Category: Dairy | [Add Batch]
  ├─ Batch: B001 | Expires: 2025-02-15 | Qty: 50 | [Edit] [Delete]
  ├─ Batch: B002 | Expires: 2025-03-20 | Qty: 30 | [Edit] [Delete]
  └─ Batch: B003 | Expires: 2025-04-05 | Qty: 20 | [Edit] [Delete]
```

---

### Priority 3: Product Forms
**Component:** Product Add/Edit Forms

**Changes Needed:**

**1. Create New Product Form:**
- Form should have two sections:
  - Product Info: name, category, supplier, location, barcode, notes
  - Initial Batch: batch number, expiry date, quantity
- Use `api.products.create.useMutation()`

**2. Create Batch Management Modal Component:**
**New File:** `src/components/products/BatchManagementModal.tsx`

**Features:**
- Modal that shows all batches for a product
- "Add Batch" button opens form
- List of existing batches with edit/delete
- Use `api.products.createBatch`, `updateBatch`, `deleteBatch` mutations

**Modal UI:**
```tsx
<Modal title="Manage Batches - Organic Milk">
  <Button>Add New Batch</Button>

  <BatchList>
    {batches.map(batch => (
      <BatchCard>
        <span>Batch: {batch.batchNumber}</span>
        <span>Expires: {batch.expiryDate}</span>
        <span>Qty: {batch.quantity}</span>
        <Button onClick={() => editBatch(batch)}>Edit</Button>
        <Button onClick={() => deleteBatch(batch.id)}>Delete</Button>
      </BatchCard>
    ))}
  </BatchList>
</Modal>
```

---

### Priority 4: Dashboard Components
**Files to Update:**

**1. ProductAlert Component**
[src/components/dashboard/ProductAlert.tsx](src/components/dashboard/ProductAlert.tsx)
- Update to show which batch is expiring
- Display product name + batch number
- Show earliest expiring batch per product

**2. QuantityUpdateModal**
[src/components/dashboard/QuantityUpdateModal.tsx](src/components/dashboard/QuantityUpdateModal.tsx)
- Update quantity for specific batch, not product
- Add dropdown to select which batch to update
- Use `api.products.updateBatch` mutation

**3. BarcodeScannerModal**
[src/components/products/BarcodeScannerModal.tsx](src/components/products/BarcodeScannerModal.tsx)
- After barcode scan, create product + first batch
- Form should include batch fields (expiry, quantity, batch number)

---

### Priority 5: Admin Dashboard
**File:** [src/app/admin/page.tsx](src/app/admin/page.tsx)

**Changes Needed:**
- Update user details modal to show products with batches
- Display batches under each product
- Show batch-level expiry status
- Use `api.admin.getUserProducts.useQuery()` (already updated)

---

## 📊 API Usage Examples for Frontend

### Fetching Products with Batches
```typescript
const { data: products } = api.products.getAll.useQuery({
  userId: user.id
});

// products structure:
// [{
//   id: "prod-1",
//   name: "Organic Milk",
//   category: "Dairy",
//   batches: [
//     { id: "batch-1", expiryDate: "2025-02-15", quantity: 50, batchNumber: "B001" },
//     { id: "batch-2", expiryDate: "2025-03-20", quantity: 30, batchNumber: "B002" }
//   ]
// }]
```

### Creating Product with Initial Batch
```typescript
const createMutation = api.products.create.useMutation();

createMutation.mutate({
  userId: user.id,
  product: {
    name: "Organic Milk",
    category: "Dairy",
    supplier: "Farm Fresh"
  },
  batch: {
    batchNumber: "B001",
    expiryDate: "2025-02-15",
    quantity: 50
  }
});
```

### Adding Batch to Existing Product
```typescript
const createBatchMutation = api.products.createBatch.useMutation();

createBatchMutation.mutate({
  userId: user.id,
  productId: "product-uuid",
  batch: {
    batchNumber: "B002",
    expiryDate: "2025-03-20",
    quantity: 30
  }
});
```

### Updating a Batch
```typescript
const updateBatchMutation = api.products.updateBatch.useMutation();

updateBatchMutation.mutate({
  userId: user.id,
  batchId: "batch-uuid",
  batch: {
    batchNumber: "B002-REVISED",
    expiryDate: "2025-03-25",
    quantity: 25
  }
});
```

### Deleting a Batch
```typescript
const deleteBatchMutation = api.products.deleteBatch.useMutation();

deleteBatchMutation.mutate({
  userId: user.id,
  batchId: "batch-uuid"
});
```

---

## 🚀 Deployment Checklist

### Before Deploying:
1. ✅ Backend migrations ready
2. ✅ Backend API updated and tested
3. ✅ Email system updated
4. ⏳ Frontend components updated (in progress)
5. ⏳ End-to-end testing

### Deployment Steps:
1. **Run Database Migrations**
   ```bash
   # Via Supabase Dashboard or CLI
   # Migrations will automatically:
   # - Create product_batches table
   # - Migrate existing data
   # - Remove old columns
   ```

2. **Deploy Backend Changes**
   - Push to main branch
   - Vercel will auto-deploy
   - Backend is backward compatible during transition

3. **Deploy Frontend Changes**
   - After frontend updates are complete
   - Test in staging first
   - Deploy to production

4. **Verify**
   - Test creating new products with batches
   - Test adding batches to existing products
   - Test email notifications
   - Test admin dashboard

---

## 🎯 Next Steps

### Immediate (Do These Next):
1. Update dashboard page to aggregate batch data
2. Update products page to display batches
3. Create batch management modal
4. Update product forms

### After That:
1. Update remaining dashboard components
2. Update admin dashboard
3. Comprehensive testing
4. Deploy to production

---

## 💡 Key Implementation Notes

- **Backwards Compatibility:** Old API still works during transition
- **Data Safety:** Migrations preserve all existing data
- **No Downtime:** Can deploy backend first, frontend later
- **Email Templates:** Already support batch numbers (no changes needed)
- **RLS Security:** Batches automatically inherit product security

---

## 📝 Testing Checklist

### Backend Testing:
- ✅ Products API returns products with batches
- ✅ Create product with initial batch works
- ✅ Add batch to existing product works
- ✅ Update batch works
- ✅ Delete batch works
- ✅ Delete product cascades to batches
- ✅ Admin API returns correct data
- ✅ Daily email queries batches correctly
- ✅ Weekly email aggregates batches correctly

### Frontend Testing (TODO):
- ⏳ Dashboard shows batch statistics
- ⏳ Products page displays all batches
- ⏳ Can create product with batch
- ⏳ Can add batch to product
- ⏳ Can edit batch
- ⏳ Can delete batch
- ⏳ Filtering works with batch dates
- ⏳ Sorting works with batch dates
- ⏳ Admin sees batch data correctly

### E2E Testing (TODO):
- ⏳ Create product → Add batches → View in dashboard
- ⏳ Scan barcode → Create product + batch
- ⏳ Email notifications include correct batch data
- ⏳ Mobile UI works with batch display
