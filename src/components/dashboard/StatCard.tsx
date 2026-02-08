import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: 'default' | 'warning' | 'destructive' | 'info';
}

const variantStyles: Record<StatCardProps['variant'], string> = {
  default: 'bg-[#10B981]/20 text-[#10B981]',
  warning: 'bg-amber-100 text-amber-600',
  destructive: 'bg-red-100 text-red-600',
  info: 'bg-blue-100 text-blue-600',
};

export const StatCard = ({ title, value, icon: Icon, variant }: StatCardProps) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md hover:border-gray-200 cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-2">{title}</p>
          <p className="text-4xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${variantStyles[variant]} transition-transform hover:scale-110`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};