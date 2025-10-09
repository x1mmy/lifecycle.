import type { ExpiryStatus } from '~/types';

export const formatDate = (date: string | Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const getDaysUntilExpiry = (expiryDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const isExpired = (expiryDate: string): boolean => {
    return getDaysUntilExpiry(expiryDate) < 0;
};

export const getExpiryStatus = (expiryDate: string): ExpiryStatus => {
    const days = getDaysUntilExpiry(expiryDate);

    if (days < 0) return 'expired';
    if (days <= 7) return 'urgent';
    if (days <= 30) return 'warning';
    return 'ok';
};

export const getExpiryStatusColor = (status: ExpiryStatus): string => {
    switch (status) {
        case 'expired':
            return 'text-destructive';
        case 'urgent':
            return 'text-destructive';
        case 'warning':
            return 'text-warning';
        default:
            return 'text-success';
    }
};

export const getExpiryStatusBg = (status: ExpiryStatus): string => {
    switch (status) {
        case 'expired':
            return 'bg-destructive/10 border-destructive';
        case 'urgent':
            return 'bg-destructive/10 border-destructive';
        case 'warning':
            return 'bg-warning/10 border-warning';
        default:
            return 'bg-success/10 border-success';
    }
};

export const sortByExpiry = <T extends { expiryDate: string }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
        const dateA = new Date(a.expiryDate).getTime();
        const dateB = new Date(b.expiryDate).getTime();
        return dateA - dateB;
    });
};