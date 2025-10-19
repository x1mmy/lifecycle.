-- Make quantity field nullable to allow empty values
ALTER TABLE products 
ALTER COLUMN quantity DROP NOT NULL;

-- Update the check constraint to allow NULL values
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_quantity_check;

ALTER TABLE products 
ADD CONSTRAINT products_quantity_check 
CHECK (quantity IS NULL OR quantity > 0);
