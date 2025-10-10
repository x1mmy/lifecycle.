import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: 'default' | 'warning' | 'destructive';
}

export const StatCard = ({ title, value, icon: Icon, variant }: StatCardProps) => {
  const variantStyles = {
    default: 'bg-indigo-100 text-indigo-600',
    warning: 'bg-amber-100 text-amber-600',
    destructive: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-2">{title}</p>
          <p className="text-4xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${variantStyles[variant]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};