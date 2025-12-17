# How to Run the Product Batches Migrations

## Prerequisites
- Access to Supabase Dashboard or Supabase CLI
- Backup your database (optional but recommended)

## Method 1: Using Supabase Dashboard (Easiest)

### Step 1: Open SQL Editor
1. Go to your Supabase project: https://app.supabase.com
2. Select your project (lifecycle)
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"**

### Step 2: Run Migration 1 - Create product_batches table
Copy and paste the entire contents of:
**File:** `supabase/migrations/20250118000001_create_product_batches.sql`

Click **"Run"** or press Ctrl+Enter

**Expected output:** "Success. No rows returned"

### Step 3: Run Migration 2 - Migrate existing data
Copy and paste the entire contents of:
**File:** `supabase/migrations/20250118000002_migrate_existing_products_to_batches.sql`

Click **"Run"** or press Ctrl+Enter

**Expected output:** "Success. X rows affected" (where X is the number of products)

### Step 4: Verify Migration
Run this query to verify:
```sql
-- Check that product_batches table exists and has data
SELECT COUNT(*) as batch_count FROM product_batches;

-- Check that old columns are removed from products
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('expiry_date', 'batch_number', 'quantity');
-- Should return 0 rows
```

---

## Method 2: Using Supabase CLI

### Step 1: Install Supabase CLI (if not installed)
```bash
npm install -g supabase
```

### Step 2: Link to your project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 3: Push migrations
```bash
supabase db push
```

This will automatically run all pending migrations in order.

---

## Method 3: Manual SQL (If migrations fail)

If the migration files don't work, run these SQL commands manually:

### Command 1: Create product_batches table
```sql
-- Create product_batches table
CREATE TABLE public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  batch_number TEXT,
  expiry_date DATE NOT NULL,
  quantity INTEGER CHECK (quantity IS NULL OR quantity > 0),
  added_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_product_batches_product_id ON public.product_batches(product_id);
CREATE INDEX idx_product_batches_expiry_date ON public.product_batches(expiry_date);

-- Enable RLS
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own product batches"
  ON public.product_batches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_batches.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert batches for their own products"
  ON public.product_batches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_batches.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own product batches"
  ON public.product_batches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_batches.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own product batches"
  ON public.product_batches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_batches.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all product batches"
  ON public.product_batches FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_product_batches_updated_at
  BEFORE UPDATE ON public.product_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

### Command 2: Migrate existing data
```sql
-- Migrate existing products to batches
INSERT INTO public.product_batches (product_id, batch_number, expiry_date, quantity, added_date)
SELECT
  id as product_id,
  batch_number,
  expiry_date,
  quantity,
  added_date
FROM public.products
WHERE expiry_date IS NOT NULL;
```

### Command 3: Remove old columns
```sql
-- Remove old columns from products table
ALTER TABLE public.products DROP COLUMN IF EXISTS expiry_date;
ALTER TABLE public.products DROP COLUMN IF EXISTS quantity;
ALTER TABLE public.products DROP COLUMN IF EXISTS batch_number;
```

---

## Troubleshooting

### Error: "column does not exist"
This means the migration was partially applied. Check which columns exist:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'products';
```

### Error: "table already exists"
The `product_batches` table was already created. Skip to migration 2.

### Need to Rollback?
Run the SQL in `ROLLBACK_IF_NEEDED.sql` to temporarily revert the changes.

---

## After Running Migrations

1. **Restart your Next.js dev server** (if running locally)
2. **Clear Supabase cache**:
   - Supabase Dashboard → Settings → API → Click "Reset connection pool"
3. **Test the API**:
   - Try creating a new product
   - Check that batches are saved correctly

---

## Verification Queries

After migration, these should work:

```sql
-- Should return your products without expiry_date column
SELECT * FROM products LIMIT 5;

-- Should return batches with product_id
SELECT * FROM product_batches LIMIT 5;

-- Should show products with their batches
SELECT
  p.name,
  p.category,
  b.batch_number,
  b.expiry_date,
  b.quantity
FROM products p
LEFT JOIN product_batches b ON b.product_id = p.id
LIMIT 10;
```

---

## Need Help?

If you encounter any issues:
1. Check the Supabase logs (Dashboard → Logs)
2. Share the error message
3. Check which columns exist in the products table
