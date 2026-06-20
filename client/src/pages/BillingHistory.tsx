import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";

export default function BillingHistory() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  const invoicesQuery = trpc.billing.getInvoiceHistory.useQuery(undefined, {
    enabled: !!user,
  });

  const subscriptionQuery = trpc.billing.getSubscriptionHistory.useQuery(undefined, {
    enabled: !!user,
  });

  if (loading || !user) {
    return null;
  }

  const invoices = invoicesQuery.data ?? [];
  const subscription = subscriptionQuery.data;

  const formatCurrency = (cents: number, currency: string) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(dollars);
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      paid: "bg-green-100 text-green-800",
      open: "bg-yellow-100 text-yellow-800",
      draft: "bg-gray-100 text-gray-800",
      void: "bg-red-100 text-red-800",
      uncollectible: "bg-red-100 text-red-800",
    };

    return (
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Billing & Invoices</h1>
          <p className="text-muted-foreground">View your subscription details and invoice history.</p>
        </div>

        {/* Current Subscription */}
        {subscription && (
          <div className="mb-8 p-6 border border-border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-4">Current Subscription</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Tier</p>
                <p className="text-lg font-semibold capitalize">{subscription.currentTier}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <p className="text-lg font-semibold capitalize">{subscription.status === "none" ? "No Active Subscription" : subscription.status}</p>
              </div>
              {subscription.currentPeriodStart && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Period Start</p>
                  <p className="text-lg font-semibold">{formatDate(subscription.currentPeriodStart)}</p>
                </div>
              )}
              {subscription.currentPeriodEnd && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Period End</p>
                  <p className="text-lg font-semibold">{formatDate(subscription.currentPeriodEnd)}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" asChild>
                <a href="/account-settings">Manage Subscription</a>
              </Button>
            </div>
          </div>
        )}

        {/* Invoice History */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Invoice History</h2>
          {invoices.length === 0 ? (
            <div className="p-6 border border-border rounded-lg bg-card text-center">
              <p className="text-muted-foreground">No invoices yet. Your invoices will appear here once you make a purchase.</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-card/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 font-semibold text-sm">Date</th>
                    <th className="text-left px-6 py-4 font-semibold text-sm">Period</th>
                    <th className="text-left px-6 py-4 font-semibold text-sm">Amount</th>
                    <th className="text-left px-6 py-4 font-semibold text-sm">Status</th>
                    <th className="text-left px-6 py-4 font-semibold text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-card/50 transition">
                      <td className="px-6 py-4 text-sm">{formatDate(invoice.createdAt)}</td>
                      <td className="px-6 py-4 text-sm">
                        {formatDate(invoice.periodStart)} — {formatDate(invoice.periodEnd)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{formatCurrency(invoice.amount, invoice.currency)}</td>
                      <td className="px-6 py-4 text-sm">{getStatusBadge(invoice.status)}</td>
                      <td className="px-6 py-4 text-sm">
                        {invoice.invoiceUrl ? (
                          <a
                            href={invoice.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Download PDF
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 p-6 border border-border rounded-lg bg-card/50">
          <h3 className="font-semibold mb-2">Need Help?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            If you have questions about your billing or invoices, please contact our support team.
          </p>
          <Button variant="outline" asChild>
            <a href="mailto:support@jimmi.fit">Contact Support</a>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
