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
    batches?: ProductBatch[];
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

// Admin Feedback Dashboard Types
export interface AdminFeedback {
    id: string;
    user_id: string | null;
    email: string | null;
    type: string | null;
    message: string;
    created_at: string;
    upvotes_count: number;
    /** Joined from profiles when user_id is set */
    business_name?: string;
}

export interface AdminFeedbackStats {
    totalFeedback: number;
    totalUpvotes: number;
    topType: string | null;
    feedbackThisWeek: number;
}
