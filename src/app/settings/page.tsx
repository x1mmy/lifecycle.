'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ChevronDown } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import { Header } from '~/components/layout/Header';

export default function SettingsPage() {
  const { user, loading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();

  const [profileData, setProfileData] = useState({
    businessName: '',
    email: '',
    phone: '',
    address: '',
  });
  
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    dailySummary: false,
    weeklyReport: false,
    alertDays: 7,
  });

  // Authentication check - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load user data
  useEffect(() => {
    if (user) {
      const metadata = user.user_metadata as { business_name?: string; phone?: string; address?: string } | undefined;
      setProfileData({
        businessName: metadata?.business_name ?? '',
        email: user.email ?? '',
        phone: metadata?.phone ?? '',
        address: metadata?.address ?? '',
      });
    }
  }, [user]);

  // Show loading spinner while checking authentication
  if (loading) {
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
                <label className="block text-sm font-medium text-gray-900 mb-2">Business Name</label>
                <input
                  type="text"
                  value={profileData.businessName}
                  onChange={(e) => setProfileData({ ...profileData, businessName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"
                  placeholder="testing123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Email Address</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"
                  placeholder="zimraan2012@gmail.com"
                />
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

              <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                Save Changes
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
                  onClick={() => setNotifications({ ...notifications, emailAlerts: !notifications.emailAlerts })}
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
                    onChange={(e) => setNotifications({ ...notifications, alertDays: Number(e.target.value) })}
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
                  onClick={() => setNotifications({ ...notifications, dailySummary: !notifications.dailySummary })}
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
                  onClick={() => setNotifications({ ...notifications, weeklyReport: !notifications.weeklyReport })}
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
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

              <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                Update Password
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
