import type { LucideIcon } from 'lucide-react';

/**
 * StatCard Component
 * 
 * A clickable statistics card with hover effects for the Dashboard
 * Displays a title, numeric value, and icon with color variants
 * 
 * Features:
 * - Hover shadow lift and border highlight
 * - Icon scales on hover for interactivity
 * - Three color variants: default (indigo), warning (amber), destructive (red)
 * - Fully clickable with cursor pointer
 * 
 * @param title - Label for the statistic (e.g., "Total Products")
 * @param value - Numeric value to display prominently
 * @param icon - Lucide icon component to render
 * @param variant - Color scheme based on stat type
 */

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: 'default' | 'warning' | 'destructive';
}

export const StatCard = ({ title, value, icon: Icon, variant }: StatCardProps) => {
  // Color schemes for different stat types
  const variantStyles = {
    default: 'bg-[#10B981]/20 text-[#10B981]',      // General stats (Total Products)
    warning: 'bg-amber-100 text-amber-600',        // Attention needed (Expiring Soon)
    destructive: 'bg-red-100 text-red-600',        // Critical (Expired)
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md hover:border-gray-200 cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-2">{title}</p>
          <p className="text-4xl font-bold text-gray-900">{value}</p>
        </div>
        {/* Icon with color variant and scale animation on hover */}
        <div className={`p-3 rounded-full ${variantStyles[variant]} transition-transform hover:scale-110`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};