'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
// import { storage } from '~/utils/storage';
// import { Settings as SettingsType } from '~/types';
// import { validateEmail, validatePassword } from '~/utils/validation';
// import { Header } from '~/components/layout/Header';
// import { Button } from '~/components/ui/button';
// import { Input } from '~/components/ui/input';
// import { Label } from '~/components/ui/label';
// import { Textarea } from '~/components/ui/textarea';
// import { Switch } from '~/components/ui/switch';
// import { useToast } from '~/hooks/use-toast';

export default function SettingsPage() {
  const { user, loading, isAuthenticated, logout } = useSupabaseAuth();
  const router = useRouter();
  // const { toast } = useToast();

  // const [settings, setSettings] = useState<SettingsType | null>(null);
  // const [profileData, setProfileData] = useState({
  //   businessName: '',
  //   email: '',
  //   phone: '',
  //   address: '',
  // });
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
  // const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Authentication check - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* <Header /> */}
     
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile and application preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Business Profile */}
          <div className="bg-card rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Business Profile</h2>
           
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Business Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-input bg-background rounded-md mt-1"
                  placeholder="Your Business Name"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Email Address</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-input bg-background rounded-md mt-1"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Phone Number</label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 border border-input bg-background rounded-md mt-1"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Business Address</label>
                <textarea
                  className="w-full px-3 py-2 border border-input bg-background rounded-md mt-1"
                  rows={3}
                  placeholder="123 Main St, City, State 12345"
                />
              </div>

              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                Save Changes
              </button>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="bg-card rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Notification Preferences</h2>
           
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Email Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts for expiring products
                  </p>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full relative">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform"></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Daily Summary</p>
                  <p className="text-sm text-muted-foreground">
                    Daily email with inventory status
                  </p>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full relative">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform"></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Weekly Report</p>
                  <p className="text-sm text-muted-foreground">
                    Weekly overview of inventory trends
                  </p>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full relative">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-card rounded-xl shadow p-6 border border-destructive/20">
            <h2 className="text-xl font-semibold text-destructive mb-4">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete your account, there is no going back. All your data will be permanently deleted.
            </p>
            <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90">
              Delete Account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
