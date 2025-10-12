export interface User {
    id: string;
    businessName: string;
    email: string;
    password: string;
    createdAt: string;
}

export interface Product {
    id: string;
    name: string;
    category: string;
    expiryDate: string;
    quantity: number;
    batchNumber?: string;
    supplier?: string;
    location?: string;
    notes?: string;
    addedDate: string;
}

export interface Settings {
    userId: string;
    businessName: string;
    email: string;
    phone?: string;
    address?: string;
    notifications: {
        emailAlerts: boolean;
        alertThreshold: number;
        dailySummary: boolean;
        weeklyReport: boolean;
    };
}

export type ExpiryStatus = "expired" | "urgent" | "warning" | "ok";

// Admin Dashboard Types
export interface AdminUserWithStats {
    id: string;
    business_name: string;
    email: string;
    phone?: string;
    address?: string;
    created_at: string;
    is_active: boolean;
    last_sign_in_at?: string;
    total_products: number;
    active_products: number;
}

export interface AdminUserProduct {
    id: string;
    name: string;
    category: string;
    expiry_date: string;
    quantity: number;
    batch_number?: string;
    supplier?: string;
    location?: string;
    notes?: string;
    barcode?: string;
    added_date: string;
    status: ExpiryStatus;
}

export interface SystemAlert {
    id: string;
    type: 'high_expired_rate' | 'inactive_user' | 'zero_inventory';
    user_id: string;
    user_name: string;
    user_email: string;
    severity: 'warning' | 'critical';
    message: string;
    details?: {
        total_products?: number;
        expired_products?: number;
        expired_rate?: number;
        days_inactive?: number;
    };
}

export interface AdminStats {
    totalUsers: number;
    totalProducts: number;
    usersWithActiveProducts: number;
    totalAlerts: number;
}
