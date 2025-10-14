"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, Package, User, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useSupabaseAuth } from "~/hooks/useSupabaseAuth";
import { Button } from "~/components/ui/button";

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAdmin } = useSupabaseAuth();

  const handleLogout = () => {
    void logout();
    router.push("/login");
  };

  // Handle mobile menu open with enhanced animation
  const handleMobileMenuOpen = () => {
    setMobileMenuOpen(true);
    setIsClosing(false);
    // Use requestAnimationFrame to ensure the DOM is updated before starting animation
    requestAnimationFrame(() => {
      setIsAnimating(true);
    });
  };

  // Handle mobile menu close with enhanced animation
  const handleMobileMenuClose = () => {
    setIsClosing(true);
    setIsAnimating(false);
    // Use a timeout to match the actual animation duration
    setTimeout(() => {
      setMobileMenuOpen(false);
      setIsClosing(false);
    }, 300); // Match CSS transition duration
  };

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  const isActive = (path: string) => pathname === path;

  // Check if we're on an admin page
  const isAdminPage = pathname?.startsWith("/admin");

  // Show different navigation based on whether we're on admin pages or regular pages
  const navLinks = isAdminPage
    ? [
        // Admin navigation
        { path: "/admin", label: "Admin Dashboard" },
        { path: "/admin/analytics", label: "Analytics" },
      ]
    : [
        // Regular user navigation
        { path: "/dashboard", label: "Dashboard" },
        { path: "/products", label: "Products" },
        { path: "/settings", label: "Settings" },
        ...(isAdmin ? [{ path: "/admin", label: "Admin" }] : []),
      ];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-8">
            {/* Logo - links to admin or dashboard depending on context */}
            <div className="nav-brand">
              <Link
                href={isAdminPage ? "/admin" : "/dashboard"}
                className="text-2xl font-bold text-gray-800"
              >
                LifeCycle
                <span className="text-sm leading-none text-purple-500">●</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-8 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? "text-indigo-600"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop User Menu */}
          <div className="hidden items-center gap-3 md:flex">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user?.user_metadata?.business_name ??
                  user?.email?.split("@")[0] ??
                  "User"}
              </p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-600"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="relative p-2 text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 active:scale-95 md:hidden"
            onClick={
              mobileMenuOpen ? handleMobileMenuClose : handleMobileMenuOpen
            }
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            <div className="relative h-6 w-6">
              <Menu
                className={`absolute inset-0 h-6 w-6 transition-all duration-300 ${
                  mobileMenuOpen
                    ? "rotate-180 opacity-0"
                    : "rotate-0 opacity-100"
                }`}
              />
              <X
                className={`absolute inset-0 h-6 w-6 transition-all duration-300 ${
                  mobileMenuOpen
                    ? "rotate-0 opacity-100"
                    : "-rotate-180 opacity-0"
                }`}
              />
            </div>
          </button>
        </div>

        {/* Mobile Navigation Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Enhanced Backdrop with blur effect */}
            <div
              className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300 ease-out ${
                isAnimating ? "opacity-100" : "opacity-0"
              }`}
              onClick={handleMobileMenuClose}
            />

            {/* Enhanced Mobile Menu with slide and scale animation */}
            <div
              className={`absolute top-0 left-0 h-full w-80 max-w-[85vw] transform bg-white shadow-2xl transition-all duration-300 ease-out ${
                isAnimating
                  ? "translate-x-0 scale-100"
                  : "-translate-x-full scale-95"
              }`}
              style={{
                // Ensure the menu starts off-screen initially
                transform: isAnimating
                  ? "translateX(0) scale(1)"
                  : "translateX(-100%) scale(0.95)",
              }}
            >
              {/* Enhanced Header with gradient */}
              <div className="relative flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-white to-gray-50 px-6 py-5">
                <Link
                  href={isAdminPage ? "/admin" : "/dashboard"}
                  onClick={handleMobileMenuClose}
                  className="text-xl font-bold text-gray-800 transition-colors hover:text-purple-600"
                >
                  LifeCycle
                  <span className="text-sm leading-none text-purple-500">
                    ●
                  </span>
                </Link>
                <button
                  onClick={handleMobileMenuClose}
                  className="rounded-full p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 active:scale-95"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Enhanced Navigation Links with staggered animation */}
              <nav className="px-4 py-6">
                <div className="space-y-1">
                  {navLinks.map((link, index) => (
                    <Link
                      key={link.path}
                      href={link.path}
                      onClick={handleMobileMenuClose}
                      className={`group flex items-center justify-between rounded-xl px-4 py-4 text-base font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        isActive(link.path)
                          ? "border border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-600 shadow-sm"
                          : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                      }`}
                      style={{
                        animationDelay: isAnimating ? `${index * 50}ms` : "0ms",
                        animation: isAnimating
                          ? "slideInFromLeft 0.3s ease-out forwards"
                          : "none",
                        opacity: isAnimating ? 1 : 0,
                        transform: isAnimating
                          ? "translateX(0)"
                          : "translateX(-20px)",
                      }}
                    >
                      <span className="flex items-center gap-3">
                        {link.path === "/dashboard" && (
                          <Package className="h-5 w-5" />
                        )}
                        {link.path === "/products" && (
                          <Package className="h-5 w-5" />
                        )}
                        {link.path === "/settings" && (
                          <User className="h-5 w-5" />
                        )}
                        {link.path.startsWith("/admin") && (
                          <User className="h-5 w-5" />
                        )}
                        {link.label}
                      </span>
                      <ChevronRight
                        className={`h-5 w-5 transition-all duration-200 ${
                          isActive(link.path)
                            ? "text-purple-400 group-hover:translate-x-1"
                            : "text-gray-300 group-hover:translate-x-1 group-hover:text-gray-400"
                        }`}
                      />
                    </Link>
                  ))}
                </div>
              </nav>

              {/* Enhanced User Account Section */}
              <div className="absolute right-0 bottom-0 left-0 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white p-6">
                <div
                  className="mb-4 flex items-center gap-3"
                  style={{
                    animationDelay: isAnimating
                      ? `${navLinks.length * 50 + 100}ms`
                      : "0ms",
                    animation: isAnimating
                      ? "slideInFromLeft 0.3s ease-out forwards"
                      : "none",
                    opacity: isAnimating ? 1 : 0,
                    transform: isAnimating
                      ? "translateX(0)"
                      : "translateX(-20px)",
                  }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 ring-2 ring-purple-200">
                    <User className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">
                      {user?.user_metadata?.business_name ??
                        user?.email?.split("@")[0] ??
                        "User"}
                    </p>
                    <p className="truncate text-sm text-gray-500">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleLogout();
                    handleMobileMenuClose();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-red-100 px-4 py-3 text-base font-medium text-red-600 transition-all duration-200 hover:scale-[1.02] hover:from-red-100 hover:to-red-200 active:scale-[0.98]"
                  style={{
                    animationDelay: isAnimating
                      ? `${navLinks.length * 50 + 150}ms`
                      : "0ms",
                    animation: isAnimating
                      ? "slideInFromLeft 0.3s ease-out forwards"
                      : "none",
                    opacity: isAnimating ? 1 : 0,
                    transform: isAnimating
                      ? "translateX(0)"
                      : "translateX(-20px)",
                  }}
                >
                  <LogOut className="h-5 w-5" />
                  Log Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
