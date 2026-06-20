import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function SubscriptionStatus() {
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(searchParams);
  const status = params.get("status");
  const sessionId = params.get("session_id");

  useEffect(() => {
    // Simulate processing the webhook/subscription update
    // In a real scenario, the webhook would have already updated the user's tier
    const timer = setTimeout(() => {
      setIsProcessing(false);
      if (status === "canceled") {
        setError("Payment was canceled. Your subscription was not updated.");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [status]);

  const handleReturnHome = () => {
    setLocation("/");
  };

  const handleReturnToSettings = () => {
    setLocation("/account-settings");
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold mb-2">Processing your payment...</h1>
          <p className="text-muted-foreground">Please wait while we confirm your subscription.</p>
        </div>
      </div>
    );
  }

  if (status === "success" && !error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-muted-foreground mb-6">
            Your subscription has been activated. You now have access to premium features with Claude AI coaching.
          </p>
          {sessionId && (
            <p className="text-sm text-muted-foreground mb-6">
              Session ID: <code className="bg-secondary px-2 py-1 rounded">{sessionId}</code>
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={handleReturnToSettings} variant="default">
              View Account Settings
            </Button>
            <Button onClick={handleReturnHome} variant="outline">
              Return Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "canceled" || error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Payment Canceled</h1>
          <p className="text-muted-foreground mb-6">
            {error || "Your payment was canceled. Your subscription was not updated."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleReturnToSettings} variant="default">
              Try Again
            </Button>
            <Button onClick={handleReturnHome} variant="outline">
              Return Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Unknown Status</h1>
        <p className="text-muted-foreground mb-6">
          We couldn't determine the status of your payment. Please check your account settings.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={handleReturnToSettings} variant="default">
            Account Settings
          </Button>
          <Button onClick={handleReturnHome} variant="outline">
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
}
