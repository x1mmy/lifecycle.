'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import { Header } from '~/components/layout/Header';
import { api } from '~/trpc/react';
import { supabase } from '~/lib/supabase';
import { useToast } from '~/hooks/use-toast';
import { Toaster } from '~/components/ui/toaster';
import { validateRequired, validateEmail } from '~/utils/validation';

export default function SettingsPage() {
  const { user, loading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [profileData, setProfileData] = useState({
    businessName: '',
    email: '',
    phone: '',
    address: '',
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
    emailAlerts: true,
    dailySummary: false,
    weeklyReport: false,
    alertDays: 7,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // tRPC hooks for data fetching and mutations
  const { data: profile, isLoading: profileLoading } = api.settings?.getProfile.useQuery(
    { userId: user?.id ?? '' },
    { enabled: !!user?.id }
  ) ?? { data: undefined, isLoading: false };

  const { data: notificationPrefs, isLoading: notificationLoading } = api.settings?.getNotificationPreferences.useQuery(
    { userId: user?.id ?? '' },
    { enabled: !!user?.id }
  ) ?? { data: undefined, isLoading: false };

  const updateProfileMutation = api.settings?.updateProfile.useMutation({
    onSuccess: async () => {
      toast({
        title: 'Profile updated successfully!',
        description: 'The profile has been updated successfully.',
        variant: 'success',
        action: <CheckCircle className="h-5 w-5 text-green-600" />,
      });
      // Refresh the user session to update the header with new business name
      try {
        await supabase.auth.refreshSession();
      } catch (error) {
        console.error('Failed to refresh session:', error);
        // Fallback to page reload if session refresh fails
        window.location.reload();
      }
    },
    onError: (error) => {
      console.error('Failed to update profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
        action: <XCircle className="h-5 w-5 text-red-600" />,
      });
    },
  }) ?? { mutate: () => void 0, isPending: false };

  const updateNotificationsMutation = api.settings?.updateNotificationPreferences.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Notification preferences updated successfully',
        variant: 'success',
        action: <CheckCircle className="h-5 w-5 text-green-600" />,
      });
    },
    onError: (error) => {
      console.error('Failed to update notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to update notification preferences. Please try again.',
        variant: 'destructive',
        action: <XCircle className="h-5 w-5 text-red-600" />,
      });
    },
  }) ?? { mutate: () => void 0, isPending: false };

  // Authentication check - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load user data from tRPC queries
  useEffect(() => {
    if (profile) {
      setProfileData({
        businessName: profile.business_name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (notificationPrefs) {
      setNotifications({
        emailAlerts: notificationPrefs.email_alerts ?? true,
        dailySummary: notificationPrefs.daily_summary ?? false,
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
      newErrors.businessName = 'Business name is required';
    }
    
    if (!validateRequired(profileData.email)) {
      newErrors.email = 'Email address is required';
    } else if (!validateEmail(profileData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // If there are validation errors, show them and don't submit
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors below before saving.',
        variant: 'destructive',
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
        emailAlerts: notifications.emailAlerts,
        alertThreshold: notifications.alertDays,
        dailySummary: notifications.dailySummary,
        weeklyReport: notifications.weeklyReport,
      },
    });
  };


  // Show loading spinner while checking authentication or loading data
  if (loading || profileLoading || notificationLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
     
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-500">
            Manage your profile and application preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Business Profile */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Business Profile</h2>
           
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profileData.businessName}
                  onChange={(e) => {
                    setProfileData({ ...profileData, businessName: e.target.value });
                    // Clear error when user starts typing
                    if (errors.businessName) {
                      setErrors({ ...errors, businessName: '' });
                    }
                  }}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white ${
                    errors.businessName 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                  placeholder="Enter your business name"
                />
                {errors.businessName && (
                  <p className="mt-1 text-sm text-red-600">{errors.businessName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => {
                    setProfileData({ ...profileData, email: e.target.value });
                    // Clear error when user starts typing
                    if (errors.email) {
                      setErrors({ ...errors, email: '' });
                    }
                  }}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white ${
                    errors.email 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                  placeholder="Enter your email address"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Business Address</label>
                <textarea
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white resize-none"
                  rows={3}
                  placeholder="123 Main St, City, State 12345"
                />
              </div>

              <button 
                onClick={handleProfileUpdate}
                disabled={updateProfileMutation.isPending}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Notification Preferences</h2>
           
            <div className="space-y-6">
              {/* Email Alerts Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Email Alerts</p>
                  <p className="text-sm text-gray-500">
                    Receive alerts for expiring products
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newValue = !notifications.emailAlerts;
                    setNotifications({ ...notifications, emailAlerts: newValue });
                    // Auto-save notification preferences
                    setTimeout(() => handleNotificationUpdate(), 100);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.emailAlerts ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.emailAlerts ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Alert Days Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Alert me when products expire in:
                </label>
                <div className="relative">
                  <select
                    value={notifications.alertDays}
                    onChange={(e) => {
                      const newValue = Number(e.target.value);
                      setNotifications({ ...notifications, alertDays: newValue });
                      // Auto-save notification preferences
                      setTimeout(() => handleNotificationUpdate(), 100);
                    }}
                    className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"
                  >
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Daily Summary Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Daily Summary</p>
                  <p className="text-sm text-gray-500">
                    Daily email with inventory status
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newValue = !notifications.dailySummary;
                    setNotifications({ ...notifications, dailySummary: newValue });
                    // Auto-save notification preferences
                    setTimeout(() => handleNotificationUpdate(), 100);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.dailySummary ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.dailySummary ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

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
                    setNotifications({ ...notifications, weeklyReport: newValue });
                    // Auto-save notification preferences
                    setTimeout(() => handleNotificationUpdate(), 100);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.weeklyReport ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.weeklyReport ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
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
    </div>
  );
}
