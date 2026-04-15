"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

interface UpgradePromptProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  currentTier: string;
  requiredTier: string;
}

export const UpgradePrompt = ({
  open,
  onClose,
  feature,
  currentTier,
  requiredTier,
}: UpgradePromptProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade Required</DialogTitle>
          <DialogDescription>
            {feature} requires the {requiredTier} plan or higher.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              Your current plan: <span className="font-semibold capitalize">{currentTier}</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Required plan: <span className="font-semibold capitalize">{requiredTier}</span>
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/pricing" className="flex-1">
              <Button className="w-full bg-[#059669] hover:bg-[#047857]">
                View Plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
