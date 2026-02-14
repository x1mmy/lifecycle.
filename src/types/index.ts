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
    supplier?: string;
    location?: string;
    notes?: string;
    barcode?: string;
    addedDate: string;
    batches?: ProductBatch[]; // Batches associated with this product
    // TEMPORARY: Old fields for backwards compatibility during migration (optional now)
    // TODO: Remove these after products page is fully updated
    expiryDate?: string;
    quantity?: number | null;
    batchNumber?: string;
}

export interface ProductBatch {
    id: string;
    productId: string;
    batchNumber?: string;
    expiryDate: string;
    quantity: number | null;
    addedDate: string;
    createdAt: string;
    updatedAt: string;
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
    supplier?: string;
    location?: string;
    notes?: string;
    barcode?: string;
    added_date: string;
    batches?: ProductBatch[];
}

export interface AdminUserProductBatch {
    id: string;
    product_id: string;
    batch_number?: string;
    expiry_date: string;
    quantity: number | null;
    added_date: string;
    status: ExpiryStatus;
}


export interface AdminStats {
    totalUsers: number;
    totalProducts: number;
    usersWithActiveProducts: number;
}

// Subscription Types
export type SubscriptionTier = "free" | "starter" | "professional";
export type SubscriptionStatus =
    | "active"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "trialing"
    | "unpaid"
    | "paused";

export interface Subscription {
    userId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
}

export interface SubscriptionUsage {
    productCount: number;
    productLimit: number;
    dailyScanCount: number;
    dailyScanLimit: number;
}

export interface SubscriptionFeatures {
    canCameraScan: boolean;
    canCustomCategories: boolean;
    canCommunityDb: boolean;
    canPrioritySupport: boolean;
}
