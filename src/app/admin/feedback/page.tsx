'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  MessageSquare,
  ThumbsUp,
  Tag,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { api } from '~/trpc/react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import { formatDateAU } from '~/utils/dateUtils';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useToast } from '~/hooks/use-toast';
import { Header } from '~/components/layout/Header';
import type { AdminFeedback } from '~/types';

const FEEDBACK_TYPES = ['All', 'Bug', 'Feature', 'Improvement', 'Other'] as const;
type FeedbackTypeFilter = (typeof FEEDBACK_TYPES)[number];

const SORT_OPTIONS = [
  { value: 'upvotes' as const, label: 'Most Upvoted' },
  { value: 'newest' as const, label: 'Newest' },
];

/**
 * Returns Badge variant or className for feedback type for consistent color coding.
 * bug = red, feature = blue, improvement = amber, other = neutral.
 */
function getTypeBadgeProps(type: string | null) {
  const t = (type ?? 'Other').toLowerCase();
  if (t === 'bug') return { variant: 'destructive' as const, className: '' };
  if (t === 'feature')
    return { variant: 'outline' as const, className: 'border-blue-200 bg-blue-50 text-blue-700' };
  if (t === 'improvement')
    return { variant: 'warning' as const, className: '' };
  return { variant: 'secondary' as const, className: '' };
}

/**
 * Admin Feedback Dashboard Page
 *
 * Lets admins view all user feedback sorted by popularity or date,
 * filter by type, see aggregated stats, and remove inappropriate feedback.
 * Auth and admin checks: middleware handles /admin/*; page guards for loading/redirect.
 */
export default function AdminFeedbackPage() {
  const { isAdmin, loading: authLoading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [typeFilter, setTypeFilter] = useState<FeedbackTypeFilter>('All');
  const [sort, setSort] = useState<'upvotes' | 'newest'>('upvotes');

  const { data: stats, isLoading: statsLoading } = api.feedback.getFeedbackStats.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  const { data: feedbackList, isLoading: listLoading, refetch: refetchFeedback } =
    api.feedback.getAllFeedback.useQuery(
      { sort, typeFilter },
      { enabled: isAdmin }
    );

  const deleteMutation = api.feedback.deleteFeedback.useMutation({
    onSuccess: () => {
      toast({ title: 'Feedback removed', description: 'The feedback item has been deleted.' });
      void refetchFeedback();
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: err.message ?? 'Failed to delete feedback',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  const handleDelete = (item: AdminFeedback) => {
    if (!window.confirm('Remove this feedback? This cannot be undone.')) return;
    deleteMutation.mutate({ id: item.id });
  };

  const isLoading = authLoading || statsLoading || listLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading feedback...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Feedback</h1>
          <p className="text-muted-foreground">
            View and manage user feedback and upvotes
          </p>
        </div>

        {/* Stats row — 4 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-card p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Feedback</p>
                <p className="text-3xl font-bold text-foreground">{stats?.totalFeedback ?? 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-500/10">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Upvotes</p>
                <p className="text-3xl font-bold text-foreground">{stats?.totalUpvotes ?? 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-500/10">
                <ThumbsUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Most Requested Type</p>
                <p className="text-xl font-bold text-foreground truncate">
                  {stats?.topType ?? '—'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-amber-500/10">
                <Tag className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">This Week</p>
                <p className="text-3xl font-bold text-foreground">
                  {stats?.feedbackThisWeek ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-500/10">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as FeedbackTypeFilter)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {FEEDBACK_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSort(opt.value)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  sort === opt.value
                    ? 'bg-[#10B981] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback cards */}
        <div className="space-y-4">
          {!feedbackList || feedbackList.length === 0 ? (
            <div className="bg-card rounded-xl shadow p-12 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">No feedback yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                When users submit feedback, it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {feedbackList.map((item) => {
                const badgeProps = getTypeBadgeProps(item.type);
                return (
                  <div
                    key={item.id}
                    className="bg-card rounded-xl shadow p-5 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="flex-shrink-0 flex items-center justify-center min-w-[2.5rem] h-10 rounded-full bg-green-100 text-green-700 font-bold text-lg"
                          title="Upvotes"
                        >
                          {item.upvotes_count}
                        </span>
                        <Badge
                          variant={badgeProps.variant}
                          className={badgeProps.className}
                        >
                          {item.type ?? 'Other'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(item)}
                        disabled={deleteMutation.isPending}
                        aria-label="Delete feedback"
                      >
                        {deleteMutation.isPending && deleteMutation.variables?.id === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-foreground leading-snug">{item.message}</p>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mt-auto">
                      <span>
                        {item.business_name ?? item.email ?? 'Anonymous'}
                      </span>
                      <span>{formatDateAU(item.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
