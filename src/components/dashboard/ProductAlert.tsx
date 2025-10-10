import type { Product } from '~/types';
import { formatDate, getDaysUntilExpiry } from '~/utils/dateUtils';
import { AlertTriangle, XCircle } from 'lucide-react';

interface ProductAlertProps {
  product: Product;
  type: 'expired' | 'expiring';
}

export const ProductAlert = ({ product, type }: ProductAlertProps) => {
  const daysUntil = getDaysUntilExpiry(product.expiryDate);
  
  const isExpired = type === 'expired';
  const Icon = isExpired ? XCircle : AlertTriangle;
  const bgColor = isExpired ? 'bg-red-50' : 'bg-amber-50';
  const textColor = isExpired ? 'text-red-600' : 'text-amber-600';
  const borderColor = isExpired ? 'border-red-100' : 'border-amber-100';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${bgColor} border ${borderColor}`}>
      <Icon className={`h-5 w-5 mt-0.5 ${textColor}`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{product.name}</p>
        <p className="text-sm text-gray-600">
          {isExpired
            ? `Expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} ago`
            : `Expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}
          {' '}
          ({formatDate(product.expiryDate)})
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {product.category} • Qty: {product.quantity}
          {product.batchNumber && ` • Batch: ${product.batchNumber}`}
        </p>
      </div>
    </div>
  );
};