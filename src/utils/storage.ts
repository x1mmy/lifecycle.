// import { User, Product, Settings } from '@/types';

// const STORAGE_KEYS = {
//   USERS: 'lifecycle_users',
//   CURRENT_USER: 'lifecycle_current_user',
//   PRODUCTS: (userId: string) => `lifecycle_products_${userId}`,
//   SETTINGS: (userId: string) => `lifecycle_settings_${userId}`,
// };

// export const storage = {
//   // User operations
//   getUsers: (): User[] => {
//     const users = localStorage.getItem(STORAGE_KEYS.USERS);
//     return users ? JSON.parse(users) : [];
//   },

//   saveUser: (user: User): void => {
//     const users = storage.getUsers();
//     users.push(user);
//     localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
//   },

//   findUserByEmail: (email: string): User | undefined => {
//     const users = storage.getUsers();
//     return users.find((user) => user.email.toLowerCase() === email.toLowerCase());
//   },

//   getCurrentUserId: (): string | null => {
//     return localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
//   },

//   setCurrentUserId: (userId: string): void => {
//     localStorage.setItem(STORAGE_KEYS.CURRENT_USER, userId);
//   },

//   clearCurrentUser: (): void => {
//     localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
//   },

//   // Product operations
//   getProducts: (userId: string): Product[] => {
//     const products = localStorage.getItem(STORAGE_KEYS.PRODUCTS(userId));
//     return products ? JSON.parse(products) : [];
//   },

//   saveProducts: (userId: string, products: Product[]): void => {
//     localStorage.setItem(STORAGE_KEYS.PRODUCTS(userId), JSON.stringify(products));
//   },

//   addProduct: (userId: string, product: Product): void => {
//     const products = storage.getProducts(userId);
//     products.push(product);
//     storage.saveProducts(userId, products);
//   },

//   updateProduct: (userId: string, productId: string, updates: Partial<Product>): void => {
//     const products = storage.getProducts(userId);
//     const index = products.findIndex((p) => p.id === productId);
//     if (index !== -1) {
//       products[index] = { ...products[index], ...updates };
//       storage.saveProducts(userId, products);
//     }
//   },

//   deleteProduct: (userId: string, productId: string): void => {
//     const products = storage.getProducts(userId);
//     const filtered = products.filter((p) => p.id !== productId);
//     storage.saveProducts(userId, filtered);
//   },

//   // Settings operations
//   getSettings: (userId: string): Settings | null => {
//     const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS(userId));
//     return settings ? JSON.parse(settings) : null;
//   },

//   saveSettings: (settings: Settings): void => {
//     localStorage.setItem(STORAGE_KEYS.SETTINGS(settings.userId), JSON.stringify(settings));
//   },

//   // Clear all data
//   clearAllData: (): void => {
//     localStorage.clear();
//   },
// };