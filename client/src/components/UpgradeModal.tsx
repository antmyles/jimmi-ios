import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  requiredTier: "core" | "pro" | "elite";
  description?: string;
}

export function UpgradeModal({
  isOpen,
  onClose,
  featureName,
  requiredTier,
  description,
}: UpgradeModalProps) {
  const [, setLocation] = useLocation();

  const tierLabels = {
    core: "Core",
    pro: "Pro",
    elite: "Elite",
  };

  const handleUpgrade = () => {
    setLocation("/pricing");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Unlock {featureName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <DialogDescription className="text-base">
            {description || `${featureName} is available on ${tierLabels[requiredTier]}, Pro, and Elite plans.`}
          </DialogDescription>

          <div className="rounded-lg bg-white/5 border border-white/10 p-4">
            <p className="text-sm text-white/70 mb-2">Upgrade to get access to:</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>{featureName}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Advanced AI coaching with {requiredTier === "elite" ? "Claude 3.5 Sonnet" : "Gemini 2.0 Flash"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Unlimited coaching sessions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Full meal planning and nutrition tracking</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Maybe later
            </Button>
            <Button
              onClick={handleUpgrade}
              className="flex-1"
            >
              View plans
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
