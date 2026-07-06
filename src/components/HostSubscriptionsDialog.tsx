import { useEffect, useMemo, useState } from 'react';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMyHostBillingAccount, listMySubscriptions } from '@/lib/billing-client';
import { formatRand } from '@/lib/currency';
import { useAuth } from '@/contexts/AuthContext';
import type { HostBillingAccount, Subscription } from '@/types';

function formatPlanLabel(plan: Subscription['plan']) {
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
}

// Author: (|╲) Klaasvaakie
export default function HostSubscriptionsDialog({
  open,
  onOpenChange,
  onOpenPricing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPricing: () => void;
}) {
  const { profile } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [billingAccount, setBillingAccount] = useState<HostBillingAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    listMySubscriptions()
      .then(async (rows) => {
        const account = await getMyHostBillingAccount();
        if (!cancelled) {
          setSubscriptions(rows);
          setBillingAccount(account);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load subscriptions.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.status === 'active'),
    [subscriptions],
  );
  const isManagedHost = profile?.managementMode === 'managed';
  const currentAccessLabel = isManagedHost ? 'Managed Hosting' : activeSubscriptions[0] ? formatPlanLabel(activeSubscriptions[0].plan) : 'None';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <CreditCard className="h-5 w-5" />
            Subscription Management
          </DialogTitle>
          <DialogDescription>
            These are the subscription rows currently loaded against your host account.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Active</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{activeSubscriptions.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Total Rows</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{subscriptions.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Current Access</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {currentAccessLabel}
            </p>
          </div>
        </div>

        {isManagedHost ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning" className="text-[10px] uppercase">managed</Badge>
              <Badge variant="secondary" className="text-[10px] uppercase">
                plan: {billingAccount?.plan ?? profile?.hostPlan ?? 'premium'}
              </Badge>
              <Badge variant={billingAccount?.billingStatus === 'active' ? 'success' : 'secondary'} className="text-[10px] uppercase">
                billing: {billingAccount?.billingStatus ?? 'unknown'}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-amber-900">
              This account is on Managed Hosting. In the current system that is tracked by the host account state and
              `managementMode`, not by a normal subscription row. Seeing `Premium` as the underlying plan is expected,
              because managed hosting upgrades the host into the managed operating lane on top of the premium plan.
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 p-12 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading subscriptions...
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {loadError}
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-500">No subscription rows exist on this account yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Plan</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Status</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Amount</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Billing</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="bg-white">
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                            {subscription.plan}
                          </Badge>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                            ID: {subscription.id}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={
                            subscription.status === 'active'
                              ? 'success'
                              : subscription.status === 'cancelled'
                                ? 'danger'
                                : 'secondary'
                          }
                          className="text-[10px] uppercase"
                        >
                          {subscription.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-slate-900">{formatRand(subscription.amount)}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{subscription.billingInterval}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        <p>Start: {new Date(subscription.startDate).toLocaleDateString()}</p>
                        <p>End: {new Date(subscription.endDate).toLocaleDateString()}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onOpenPricing}>
            Open Pricing
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
