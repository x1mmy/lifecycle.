"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ChevronDown,
  CheckCircle,
  XCircle,
  Plus,
  Edit,
  Trash2,
  Package,
  Search,
  AlertCircle,
} from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import { useSupabaseAuth } from "~/hooks/useSupabaseAuth";
import { Header } from "~/components/layout/Header";
import { api } from "~/trpc/react";
import { supabase } from "~/lib/supabase";
import { useToast } from "~/hooks/use-toast";
import { Toaster } from "~/components/ui/toaster";
import { validateRequired, validateEmail } from "~/utils/validation";
import { CategoryModal } from "~/components/settings/CategoryModal";

export default function SettingsPage() {
  const { user, loading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [profileData, setProfileData] = useState({
    businessName: "",
    email: "",
    phone: "",
    address: "",
  });

  // const [passwordData, setPasswordData] = useState({
  //   current: '',
  //   new: '',
  //   confirm: '',
  // });

  // const [showPasswords, setShowPasswords] = useState({
  //   current: false,
  //   new: false,
  //   confirm: false,
  // });

  const [notifications, setNotifications] = useState({
    dailyExpiryAlerts: true,
    weeklyReport: false,
    alertDays: 7,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Categories state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{
    id: string;
    name: string;
    description: string | null;
  } | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] =
    useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  /**
   * Multi-Select State for Categories
   */
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastSelectedCategoryIndex, setLastSelectedCategoryIndex] = useState<
    number | null
  >(null);
  const [isDraggingCategories, setIsDraggingCategories] = useState(false);
  const [dragStartCategoryIndex, setDragStartCategoryIndex] = useState<
    number | null
  >(null);
  const [bulkDeleteCategoriesModalOpen, setBulkDeleteCategoriesModalOpen] =
    useState(false);
  const [isBulkDeletingCategories, setIsBulkDeletingCategories] =
    useState(false);

  interface CategoryProductSummary {
    id: string;
    name: string;
    expiryDate: string;
    quantity: number | null;
  }

  // tRPC hooks for data fetching and mutations
  const { data: profile, isLoading: profileLoading } =
    api.settings?.getProfile.useQuery(
      { userId: user?.id ?? "" },
      { enabled: !!user?.id },
    ) ?? { data: undefined, isLoading: false };

  const { data: notificationPrefs, isLoading: notificationLoading } =
    api.settings?.getNotificationPreferences.useQuery(
      { userId: user?.id ?? "" },
      { enabled: !!user?.id },
    ) ?? { data: undefined, isLoading: false };

  const updateProfileMutation = api.settings?.updateProfile.useMutation({
    onSuccess: async () => {
      toast({
        title: "Profile updated successfully!",
        description: "The profile has been updated successfully.",
        variant: "success",
        action: <CheckCircle className="h-5 w-5 text-green-600" />,
      });
      // Refresh the user session to update the header with new business name
      try {
        await supabase.auth.refreshSession();
      } catch (error) {
        console.error("Failed to refresh session:", error);
        // Fallback to page reload if session refresh fails
        window.location.reload();
      }
    },
    onError: (error) => {
      console.error("Failed to update profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
        action: <XCircle className="h-5 w-5 text-red-600" />,
      });
    },
  }) ?? { mutate: () => void 0, isPending: false };

  const updateNotificationsMutation =
    api.settings?.updateNotificationPreferences.useMutation({
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Notification preferences updated successfully",
          variant: "success",
          action: <CheckCircle className="h-5 w-5 text-green-600" />,
        });
      },
      onError: (error) => {
        console.error("Failed to update notifications:", error);
        toast({
          title: "Error",
          description:
            "Failed to update notification preferences. Please try again.",
          variant: "destructive",
          action: <XCircle className="h-5 w-5 text-red-600" />,
        });
      },
    }) ?? { mutate: () => void 0, isPending: false };

  // Categories tRPC hooks
  const utils = api.useUtils();
  const { data: categories = [], isLoading: categoriesLoading } =
    api.settings?.getCategories.useQuery(
      { userId: user?.id ?? "" },
      { enabled: !!user?.id },
    ) ?? { data: [], isLoading: false };

  const createCategoryMutation = api.settings?.createCategory.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Category created successfully",
        variant: "success",
        action: <CheckCircle className="h-5 w-5 text-green-600" />,
      });
      void utils.settings.getCategories.invalidate({ userId: user?.id ?? "" });
      // Also invalidate products categories for dropdown
      if (user?.id) {
        void utils.products.getCategories.invalidate({ userId: user.id });
      }
    },
    onError: (error) => {
      console.error("Failed to create category:", error);
      toast({
        title: "Error",
        description:
          error.message || "Failed to create category. Please try again.",
        variant: "destructive",
        action: <XCircle className="h-5 w-5 text-red-600" />,
      });
      throw error instanceof Error
        ? error
        : new Error("Failed to create category");
    },
  }) ?? { mutateAsync: async () => Promise.resolve(), isPending: false };

  const categoryProductsQuery = api.settings?.getCategoryProducts.useQuery(
    {
      userId: user?.id ?? "",
      categoryId: selectedCategory?.id ?? "",
    },
    {
      enabled: isCategoryModalOpen && !!user?.id && !!selectedCategory?.id,
    },
  ) ?? { data: undefined, isLoading: false };

  const categoryProducts: CategoryProductSummary[] =
    (categoryProductsQuery.data?.products as CategoryProductSummary[]) ?? [];

  const deleteProductFromCategoryMutation = api.products.delete.useMutation({
    onSuccess: async () => {
      toast({
        title: "Product deleted",
        description: "The product was removed successfully.",
        variant: "success",
        action: <CheckCircle className="h-5 w-5 text-green-600" />,
      });
      if (user?.id && selectedCategory?.id) {
        await utils.settings.getCategoryProducts.invalidate({
          userId: user.id,
          categoryId: selectedCategory.id,
        });
        await utils.products.getAll.invalidate({ userId: user.id });
      }
    },
    onError: (error) => {
      console.error("Failed to delete product:", error);
      toast({
        title: "Error",
        description:
          error.message || "Failed to delete product. Please try again.",
        variant: "destructive",
        action: <XCircle className="h-5 w-5 text-red-600" />,
      });
    },
  }) ?? { mutate: () => void 0, isPending: false };

  const updateCategoryMutation = api.settings?.updateCategory.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Category updated successfully",
        variant: "success",
        action: <CheckCircle className="h-5 w-5 text-green-600" />,
      });
      void utils.settings.getCategories.invalidate({ userId: user?.id ?? "" });
      // Also invalidate products categories for dropdown and products list
      if (user?.id) {
        void utils.products.getCategories.invalidate({ userId: user.id });
        void utils.products.getAll.invalidate({ userId: user.id });
        if (selectedCategory?.id) {
          void utils.settings.getCategoryProducts.invalidate({
            userId: user.id,
            categoryId: selectedCategory.id,
          });
        }
      }
    },
    onError: (error) => {
      console.error("Failed to update category:", error);
      toast({
        title: "Error",
        description:
          error.message || "Failed to update category. Please try again.",
        variant: "destructive",
        action: <XCircle className="h-5 w-5 text-red-600" />,
      });
      throw error instanceof Error
        ? error
        : new Error("Failed to update category");
    },
  }) ?? { mutateAsync: async () => Promise.resolve(), isPending: false };

  const deleteCategoryMutation = api.settings?.deleteCategory.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Category deleted successfully",
        variant: "success",
        action: <CheckCircle className="h-5 w-5 text-green-600" />,
      });
      void utils.settings.getCategories.invalidate({ userId: user?.id ?? "" });
      setIsDeleteCategoryModalOpen(false);
      setCategoryToDelete(null);
      // Also invalidate products categories for dropdown
      if (user?.id) {
        void utils.products.getCategories.invalidate({ userId: user.id });
        if (selectedCategory?.id) {
          void utils.settings.getCategoryProducts.invalidate({
            userId: user.id,
            categoryId: selectedCategory.id,
          });
        }
      }
    },
    onError: (error) => {
      console.error("Failed to delete category:", error);
      toast({
        title: "Error",
        description:
          error.message || "Failed to delete category. Please try again.",
        variant: "destructive",
        action: <XCircle className="h-5 w-5 text-red-600" />,
      });
    },
  }) ?? { mutate: () => void 0, isPending: false };

  // Authentication check - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  // Load user data from tRPC queries
  useEffect(() => {
    if (profile) {
      setProfileData({
        businessName: profile.business_name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (notificationPrefs) {
      setNotifications({
        dailyExpiryAlerts:
          notificationPrefs.daily_expiry_alerts_enabled ?? true,
        weeklyReport: notificationPrefs.weekly_report ?? false,
        alertDays: notificationPrefs.alert_threshold ?? 7,
      });
    }
  }, [notificationPrefs]);

  // Handler functions
  const handleProfileUpdate = () => {
    if (!user?.id) return;

    // Clear previous errors
    setErrors({});

    // Validate required fields
    const newErrors: Record<string, string> = {};

    if (!validateRequired(profileData.businessName)) {
      newErrors.businessName = "Business name is required";
    }

    if (!validateRequired(profileData.email)) {
      newErrors.email = "Email address is required";
    } else if (!validateEmail(profileData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // If there are validation errors, show them and don't submit
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: "Validation Error",
        description: "Please fix the errors below before saving.",
        variant: "destructive",
        action: <XCircle className="h-5 w-5 text-red-600" />,
      });
      return;
    }

    updateProfileMutation.mutate({
      userId: user.id,
      profile: {
        businessName: profileData.businessName,
        phone: profileData.phone,
        address: profileData.address,
      },
    });
  };

  const handleNotificationUpdate = () => {
    if (!user?.id) return;

    updateNotificationsMutation.mutate({
      userId: user.id,
      preferences: {
        dailyExpiryAlerts: notifications.dailyExpiryAlerts,
        alertThreshold: notifications.alertDays,
        weeklyReport: notifications.weeklyReport,
      },
    });
  };

  // Category handlers
  const handleOpenAddCategory = () => {
    setSelectedCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (category: {
    id: string;
    name: string;
    description: string | null;
  }) => {
    setSelectedCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setSelectedCategory(null);
  };

  const handleRequestDeleteCategory = (category: {
    id: string;
    name: string;
  }) => {
    setCategoryToDelete(category);
    setIsDeleteCategoryModalOpen(true);
  };

  const handleCancelDeleteCategory = () => {
    setIsDeleteCategoryModalOpen(false);
    setCategoryToDelete(null);
  };

  const handleSaveCategory = async (
    name: string,
    description: string | null,
  ) => {
    if (!user?.id) return;

    if (selectedCategory) {
      // Update existing category
      await updateCategoryMutation.mutateAsync({
        categoryId: selectedCategory.id,
        userId: user.id,
        name,
        description,
      });
    } else {
      // Create new category
      await createCategoryMutation.mutateAsync({
        userId: user.id,
        name,
        description,
      });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!user?.id) return;
    deleteCategoryMutation.mutate({
      categoryId,
      userId: user.id,
    });
  };

  const handleEditProductFromCategory = (productId: string) => {
    router.push(`/products?productId=${productId}`);
  };

  const handleDeleteProductFromCategory = (productId: string) => {
    if (!user?.id) return;
    deleteProductFromCategoryMutation.mutate({
      productId,
      userId: user.id,
    });
  };

  /**
   * Category Multi-Select Handlers
   */
  // Get filtered categories for selection
  const filteredCategories = useMemo(() => {
    if (!categories.length) return [];
    if (!categorySearchQuery.trim()) return categories;
    const query = categorySearchQuery.toLowerCase().trim();
    return categories.filter((category) => {
      const nameMatch = category.name.toLowerCase().includes(query);
      const descriptionMatch = category.description
        ?.toLowerCase()
        .includes(query);
      return nameMatch || descriptionMatch;
    });
  }, [categories, categorySearchQuery]);

  // Toggle individual category selection
  const handleToggleCategorySelection = (
    categoryId: string,
    index: number,
    event?: React.MouseEvent,
  ) => {
    // Handle shift-click for range selection
    if (event?.shiftKey && lastSelectedCategoryIndex !== null) {
      const start = Math.min(lastSelectedCategoryIndex, index);
      const end = Math.max(lastSelectedCategoryIndex, index);
      const newSelectedIds = new Set(selectedCategoryIds);

      for (let i = start; i <= end; i++) {
        if (i < filteredCategories.length) {
          newSelectedIds.add(filteredCategories[i]!.id);
        }
      }

      setSelectedCategoryIds(newSelectedIds);
      setLastSelectedCategoryIndex(index);
      return;
    }

    // Regular toggle
    const newSelectedIds = new Set(selectedCategoryIds);
    if (newSelectedIds.has(categoryId)) {
      newSelectedIds.delete(categoryId);
    } else {
      newSelectedIds.add(categoryId);
    }
    setSelectedCategoryIds(newSelectedIds);
    setLastSelectedCategoryIndex(index);
  };

  // Select all visible categories
  const handleSelectAllCategories = useCallback(
    (checked: boolean) => {
      setSelectedCategoryIds((prevSelectedIds) => {
        const newSelectedIds = new Set(prevSelectedIds);
        if (checked) {
          filteredCategories.forEach((category) => {
            newSelectedIds.add(category.id);
          });
        } else {
          filteredCategories.forEach((category) => {
            newSelectedIds.delete(category.id);
          });
        }
        return newSelectedIds;
      });
    },
    [filteredCategories],
  );

  // Check if all visible categories are selected
  const allCategoriesSelected = useMemo(() => {
    if (filteredCategories.length === 0) return false;
    return filteredCategories.every((category) =>
      selectedCategoryIds.has(category.id),
    );
  }, [filteredCategories, selectedCategoryIds]);

  // Clear all category selections
  const handleClearCategorySelection = useCallback(() => {
    setSelectedCategoryIds(new Set());
    setLastSelectedCategoryIndex(null);
  }, []);

  // Track the initial selection state when drag starts for categories
  const dragStartCategorySelectedState = useRef<boolean>(false);
  const initialCategorySelectionState = useRef<Set<string>>(new Set());

  // Drag selection handlers for categories
  const handleCategoryMouseDown = (index: number, event?: React.MouseEvent) => {
    // Don't start drag if clicking directly on checkbox or its children
    if (event?.target instanceof HTMLElement) {
      // Check if clicking on checkbox button or its children (SVG check icon)
      const isCheckboxClick = Boolean(
        (event.target.closest('button[type="button"]')?.querySelector("svg") ??
          event.target.tagName === "svg") ||
          event.target.closest("[data-state]"),
      );

      if (isCheckboxClick) {
        return;
      }
    }

    setIsDraggingCategories(true);
    setDragStartCategoryIndex(index);
    // Remember the initial state of the starting item and all selections
    const categoryId = filteredCategories[index]!.id;
    dragStartCategorySelectedState.current =
      selectedCategoryIds.has(categoryId);
    initialCategorySelectionState.current = new Set(selectedCategoryIds);

    // Toggle the starting item to the opposite state
    const newSelectedIds = new Set(selectedCategoryIds);
    if (dragStartCategorySelectedState.current) {
      newSelectedIds.delete(categoryId);
    } else {
      newSelectedIds.add(categoryId);
    }
    setSelectedCategoryIds(newSelectedIds);
  };

  const handleCategoryMouseEnter = (index: number) => {
    if (isDraggingCategories && dragStartCategoryIndex !== null) {
      const start = Math.min(dragStartCategoryIndex, index);
      const end = Math.max(dragStartCategoryIndex, index);

      // Start with the initial selection state (before drag started)
      const newSelectedIds = new Set(initialCategorySelectionState.current);

      // Set all items in range to the NEW state (opposite of initial state)
      // If starting item was initially selected, deselect all in range
      // If starting item was initially unselected, select all in range
      const targetState = !dragStartCategorySelectedState.current;
      for (let i = start; i <= end; i++) {
        if (i < filteredCategories.length) {
          if (targetState) {
            newSelectedIds.add(filteredCategories[i]!.id);
          } else {
            newSelectedIds.delete(filteredCategories[i]!.id);
          }
        }
      }

      setSelectedCategoryIds(newSelectedIds);
    }
  };

  const handleCategoryMouseUp = () => {
    setIsDraggingCategories(false);
    setDragStartCategoryIndex(null);
    dragStartCategorySelectedState.current = false;
    initialCategorySelectionState.current = new Set();
  };

  // Add global mouse up listener to properly end drag selection for categories
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingCategories) {
        handleCategoryMouseUp();
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDraggingCategories]);

  // Bulk delete categories handler
  const handleBulkDeleteCategories = async () => {
    if (!user || selectedCategoryIds.size === 0) return;

    setIsBulkDeletingCategories(true);
    const selectedArray = Array.from(selectedCategoryIds);
    let successCount = 0;
    let failCount = 0;
    const failedCategories: string[] = [];
    const errors: string[] = [];

    try {
      for (const categoryId of selectedArray) {
        try {
          // Use mutateAsync if available, otherwise use mutate with Promise
          if (deleteCategoryMutation.mutateAsync) {
            await deleteCategoryMutation.mutateAsync({
              categoryId,
              userId: user.id,
            });
          } else {
            await new Promise<void>((resolve, reject) => {
              deleteCategoryMutation.mutate(
                {
                  categoryId,
                  userId: user.id,
                },
                {
                  onSuccess: () => resolve(),
                  onError: (error) =>
                    reject(
                      error instanceof Error
                        ? error
                        : new Error("Delete failed"),
                    ),
                },
              );
            });
          }
          successCount++;
        } catch (error) {
          failCount++;
          const category = categories.find((c) => c.id === categoryId);
          if (category) {
            failedCategories.push(category.name);
            if (error instanceof Error) {
              errors.push(error.message);
            }
          }
        }
      }

      if (successCount > 0) {
        toast({
          title: "Categories deleted",
          description: `Successfully deleted ${successCount} categor${successCount !== 1 ? "ies" : "y"}.${failCount > 0 ? ` ${failCount} failed.` : ""}`,
        });
        handleClearCategorySelection();
      }

      if (failCount > 0) {
        const errorMessage =
          errors[0] ?? "Some categories could not be deleted";
        toast({
          title: "Some deletions failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error during bulk category delete:", error);
      toast({
        title: "Error",
        description: "An error occurred during bulk deletion",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeletingCategories(false);
      setBulkDeleteCategoriesModalOpen(false);
    }
  };

  // Show loading spinner while checking authentication or loading data
  if (loading || profileLoading || notificationLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">
            Manage your business profile, categories, and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Business Profile */}
          <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Business Profile
            </h2>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profileData.businessName}
                  onChange={(e) => {
                    setProfileData({
                      ...profileData,
                      businessName: e.target.value,
                    });
                    // Clear error when user starts typing
                    if (errors.businessName) {
                      setErrors({ ...errors, businessName: "" });
                    }
                  }}
                  className={`w-full rounded-lg border px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                    errors.businessName
                      ? "border-red-300 bg-red-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                  placeholder="Enter your business name"
                />
                {errors.businessName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.businessName}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => {
                    setProfileData({ ...profileData, email: e.target.value });
                    // Clear error when user starts typing
                    if (errors.email) {
                      setErrors({ ...errors, email: "" });
                    }
                  }}
                  className={`w-full rounded-lg border px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                    errors.email
                      ? "border-red-300 bg-red-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                  placeholder="Enter your email address"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData({ ...profileData, phone: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Business Address
                </label>
                <textarea
                  value={profileData.address}
                  onChange={(e) =>
                    setProfileData({ ...profileData, address: e.target.value })
                  }
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  rows={3}
                  placeholder="123 Main St, City, State 12345"
                />
              </div>

              <button
                onClick={handleProfileUpdate}
                disabled={updateProfileMutation.isPending}
                className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>

          {/* Categories */}
          <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Categories
              </h2>
              <button
                onClick={handleOpenAddCategory}
                className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium whitespace-nowrap text-white transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add Category</span>
              </button>
            </div>

            {/* Search Filter */}
            {categories.length > 0 && !categoriesLoading && (
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    placeholder="Search categories by name or description..."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pr-4 pl-10 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {categoriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 h-16 w-16 text-gray-300" />
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  No Categories Yet
                </h3>
                <p className="mb-6 max-w-sm text-gray-500">
                  Create categories to organize your products
                </p>
                <button
                  onClick={handleOpenAddCategory}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Create First Category
                </button>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="mb-4 h-12 w-12 text-gray-300" />
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  No categories found
                </h3>
                <p className="text-gray-500">
                  No categories match &quot;{categorySearchQuery}&quot;
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="w-12 px-4 py-3 text-left">
                        <Checkbox
                          checked={allCategoriesSelected}
                          onCheckedChange={handleSelectAllCategories}
                          aria-label="Select all categories"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        NAME
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map((category, index) => (
                      <tr
                        key={category.id}
                        className={`border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                          selectedCategoryIds.has(category.id)
                            ? "bg-indigo-50"
                            : ""
                        } ${isDraggingCategories ? "cursor-grabbing" : ""}${isDraggingCategories ? "select-none" : ""}`}
                        onMouseDown={(e) => handleCategoryMouseDown(index, e)}
                        onMouseEnter={() => handleCategoryMouseEnter(index)}
                      >
                        <td className="w-12 px-4 py-4">
                          <Checkbox
                            checked={selectedCategoryIds.has(category.id)}
                            onCheckedChange={() =>
                              handleToggleCategorySelection(category.id, index)
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCategorySelection(
                                category.id,
                                index,
                                e,
                              );
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            aria-label={`Select ${category.name}`}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {category.name}
                            </p>
                            {category.description && (
                              <p className="mt-1 text-sm text-gray-500">
                                {category.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                handleOpenEditCategory({
                                  id: category.id,
                                  name: category.name,
                                  description: category.description,
                                })
                              }
                              className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                              disabled={deleteCategoryMutation.isPending}
                            >
                              <span className="hidden sm:inline">Edit</span>
                              <Edit className="h-4 w-4 sm:hidden" />
                            </button>
                            <button
                              onClick={() =>
                                handleRequestDeleteCategory({
                                  id: category.id,
                                  name: category.name,
                                })
                              }
                              className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                              disabled={deleteCategoryMutation.isPending}
                            >
                              <span className="hidden sm:inline">Delete</span>
                              <Trash2 className="h-4 w-4 sm:hidden" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Floating Action Button for Bulk Delete Categories - Desktop/Tablet */}
          {selectedCategoryIds.size > 0 && (
            <>
              <div className="fixed right-6 bottom-6 z-40 hidden transition-all duration-300 md:block">
                <button
                  onClick={() => setBulkDeleteCategoriesModalOpen(true)}
                  className="flex items-center gap-3 rounded-full bg-red-600 px-6 py-4 font-medium text-white shadow-lg transition-all hover:bg-red-700 hover:shadow-xl active:scale-95"
                  aria-label={`Delete ${selectedCategoryIds.size} selected categor${selectedCategoryIds.size !== 1 ? "ies" : "y"}`}
                >
                  <Trash2 className="h-5 w-5" />
                  <span>
                    Delete {selectedCategoryIds.size}{" "}
                    {selectedCategoryIds.size === 1 ? "category" : "categories"}
                  </span>
                </button>
              </div>

              {/* Mobile FAB - Full width on small screens */}
              <div className="fixed right-0 bottom-0 left-0 z-40 block transition-all duration-300 md:hidden">
                <div className="border-t border-gray-200 bg-white p-4 shadow-lg">
                  <button
                    onClick={() => setBulkDeleteCategoriesModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-700"
                  >
                    <Trash2 className="h-5 w-5" />
                    <span>
                      Delete {selectedCategoryIds.size}{" "}
                      {selectedCategoryIds.size === 1
                        ? "category"
                        : "categories"}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Bulk Delete Categories Confirmation Modal */}
          {bulkDeleteCategoriesModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 text-lg font-semibold text-gray-900">
                      Delete Selected Categories
                    </h3>
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete{" "}
                      <span className="font-medium text-gray-900">
                        {selectedCategoryIds.size} selected categor
                        {selectedCategoryIds.size !== 1 ? "ies" : "y"}
                      </span>
                      ? This action cannot be undone. Categories with products
                      cannot be deleted.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setBulkDeleteCategoriesModalOpen(false)}
                    disabled={isBulkDeletingCategories}
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDeleteCategories}
                    disabled={isBulkDeletingCategories}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBulkDeletingCategories ? (
                      <>
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification Preferences */}
          <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Notification Preferences
            </h2>

            <div className="space-y-6">
              {/* Daily Expiry Alerts Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    Daily Expiry Alerts
                  </p>
                  <p className="text-sm text-gray-500">
                    Daily email with all products expiring within your chosen
                    timeframe
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newValue = !notifications.dailyExpiryAlerts;
                    setNotifications({
                      ...notifications,
                      dailyExpiryAlerts: newValue,
                    });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.dailyExpiryAlerts
                      ? "bg-indigo-600"
                      : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.dailyExpiryAlerts
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Alert Days Dropdown - Only show when daily alerts are enabled */}
              {notifications.dailyExpiryAlerts && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Include products expiring within:
                  </label>
                  <div className="relative">
                    <select
                      value={notifications.alertDays}
                      onChange={(e) => {
                        const newValue = Number(e.target.value);
                        setNotifications({
                          ...notifications,
                          alertDays: newValue,
                        });
                      }}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-900 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value={3}>3 days</option>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
              )}

              {/* Weekly Report Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Weekly Report</p>
                  <p className="text-sm text-gray-500">
                    Weekly overview of inventory trends
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newValue = !notifications.weeklyReport;
                    setNotifications({
                      ...notifications,
                      weeklyReport: newValue,
                    });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.weeklyReport ? "bg-indigo-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.weeklyReport
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
            <button
              onClick={handleNotificationUpdate}
              disabled={updateNotificationsMutation.isPending}
              className="mt-8 rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateNotificationsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Notifications"
              )}
            </button>
          </div>

          {/* Change Password */}
          {/* <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Change Password</h2>
           
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.current}
                    onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                    className="w-full px-4 py-2 pr-10 border border-gray-200 bg-gray-50 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.new}
                    onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                    className="w-full px-4 py-2 pr-10 border border-gray-200 bg-gray-50 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordData.confirm}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                    className="w-full px-4 py-2 pr-10 border border-gray-200 bg-gray-50 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button 
                onClick={handlePasswordReset}
                disabled={requestPasswordResetMutation.isPending}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requestPasswordResetMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Sending...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
              
              <p className="text-sm text-gray-500 mt-2">
                We&apos;ll send you an email with instructions to reset your password.
              </p>
            </div>
          </div> */}
        </div>
      </main>
      <Toaster />

      {isDeleteCategoryModalOpen && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-semibold text-gray-900">
                  Delete Category
                </h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-gray-900">
                    {categoryToDelete.name}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelDeleteCategory}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                disabled={deleteCategoryMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCategory(categoryToDelete.id)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={deleteCategoryMutation.isPending}
              >
                {deleteCategoryMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={handleCloseCategoryModal}
        category={selectedCategory}
        onSave={handleSaveCategory}
        isLoading={
          createCategoryMutation.isPending || updateCategoryMutation.isPending
        }
        products={categoryProducts}
        productsLoading={categoryProductsQuery.isLoading}
        onEditProduct={handleEditProductFromCategory}
        onDeleteProduct={handleDeleteProductFromCategory}
        userId={user?.id}
      />
    </div>
  );
}
