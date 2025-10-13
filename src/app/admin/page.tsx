'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users, Package, Activity, Eye, CheckCircle, XCircle } from 'lucide-react';
import { api } from '~/trpc/react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import { formatDate } from '~/utils/dateUtils';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '~/components/ui/dialog';
import { useToast } from '~/hooks/use-toast';
import { Header } from '~/components/layout/Header';
import type { AdminUserWithStats } from '~/types';

/**
 * Admin Dashboard Page - Protected Route for Admin Users Only
 * 
 * Features:
 * - View all users with product statistics
 * - System alerts for critical issues
 * - User details modal with full product inventory
 * - Activate/deactivate user accounts
 */
export default function AdminDashboardPage() {
  const { isAdmin, loading: authLoading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = useState<AdminUserWithStats | null>(null);

  // tRPC queries
  const { data: stats, isLoading: statsLoading } = api.admin.getAdminStats.useQuery(undefined, {
    enabled: isAdmin,
  });
  
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = api.admin.getAllUsersWithStats.useQuery(undefined, {
    enabled: isAdmin,
  });
  

  const { data: userProducts, isLoading: productsLoading } = api.admin.getUserProducts.useQuery(
    { userId: selectedUser?.id ?? '' },
    { enabled: !!selectedUser }
  );

  // Mutations
  const toggleStatusMutation = api.admin.toggleUserStatus.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: data.message,
      });
      void refetchUsers();
      setSelectedUser(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Check authentication (middleware already handles admin role check)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  // Show loading spinner while checking authentication or loading data
  if (authLoading || statsLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (middleware handles admin check)
  if (!isAuthenticated) {
    return null;
  }

  const handleToggleUserStatus = (userId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (window.confirm(`Are you sure you want to ${action} this user account?`)) {
      toggleStatusMutation.mutate({ userId, isActive: newStatus });
    }
  };


  const getExpiryBadgeVariant = (status: string) => {
    switch (status) {
      case 'expired':
        return 'destructive';
      case 'urgent':
        return 'destructive';
      case 'warning':
        return 'warning';
      default:
        return 'success';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage all users and tenants</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Users */}
          <div className="bg-card p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                <p className="text-3xl font-bold text-foreground">{stats?.totalUsers ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>

          {/* Total Products */}
          <div className="bg-card p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Products</p>
                <p className="text-3xl font-bold text-foreground">{stats?.totalProducts ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Users with Active Products */}
          <div className="bg-card p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active Users</p>
                <p className="text-3xl font-bold text-foreground">{stats?.usersWithActiveProducts ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Activity className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>

        </div>


        {/* Users Table */}
        <div className="bg-card p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold text-foreground mb-4">All Users / Tenants</h2>
          
          {!users || users.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No users found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.business_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone ?? '-'}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {user.total_products} total / {user.active_products} active
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'}
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'destructive'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* User Details Modal */}
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>User Details: {selectedUser?.business_name}</DialogTitle>
              <DialogDescription>
                View and manage user information and product inventory
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-6">
                {/* User Information */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedUser.phone ?? 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{selectedUser.address ?? 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Joined</p>
                    <p className="font-medium">{formatDate(selectedUser.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Login</p>
                    <p className="font-medium">
                      {selectedUser.last_sign_in_at ? formatDate(selectedUser.last_sign_in_at) : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Account Status</p>
                    <Badge variant={selectedUser.is_active ? 'default' : 'destructive'}>
                      {selectedUser.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>

                {/* Product Statistics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-muted-foreground mb-1">Total Products</p>
                    <p className="text-2xl font-bold text-blue-700">{selectedUser.total_products}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-muted-foreground mb-1">Active Products</p>
                    <p className="text-2xl font-bold text-green-700">{selectedUser.active_products}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-muted-foreground mb-1">Expired Products</p>
                    <p className="text-2xl font-bold text-red-700">
                      {selectedUser.total_products - selectedUser.active_products}
                    </p>
                  </div>
                </div>

                {/* Product Inventory */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Product Inventory</h3>
                  {productsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : !userProducts || userProducts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No products found</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Expiry Date</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userProducts.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell>{product.category}</TableCell>
                              <TableCell>{formatDate(product.expiry_date)}</TableCell>
                              <TableCell>{product.quantity}</TableCell>
                              <TableCell>
                                <Badge variant={getExpiryBadgeVariant(product.status)}>
                                  {product.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedUser(null)}
              >
                Close
              </Button>
              {selectedUser && (
                <Button
                  variant={selectedUser.is_active ? 'destructive' : 'default'}
                  onClick={() => handleToggleUserStatus(selectedUser.id, selectedUser.is_active)}
                  disabled={toggleStatusMutation.isPending}
                >
                  {toggleStatusMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : selectedUser.is_active ? (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Deactivate Account
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Activate Account
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
