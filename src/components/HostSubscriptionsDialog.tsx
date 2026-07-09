import { useEffect, useMemo, useState } from 'react';
import { CreditCard, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { cancelMySubscription, changeMySubscription, getMyHostBillingAccount, listMySubscriptions } from '@/lib/billing-client';
import { formatRand } from '@/lib/currency';
import { useAuth } from '@/contexts/AuthContext';
import type { HostBillingAccount, HostPlan, Subscription, UserProfile } from '@/types';

const planLabels: Record<HostPlan, string> = {
  standard: 'Standard',
  professional: 'Professional',
  premium: 'Premium',
};

const selfServicePlanOptions: HostPlan[] = ['standard', 'professional', 'premium'];

function formatPlanLabel(plan: HostPlan) {
  return planLabels[plan];
}

function getChangeButtonLabel(currentPlan: HostPlan, selectedPlan: HostPlan) {
  if (currentPlan === selectedPlan) {
    return 'Current plan selected';
  }
  const order: HostPlan[] = ['standard', 'professional', 'premium'];
  return order.indexOf(selectedPlan) > order.indexOf(currentPlan) ? 'Upgrade' : 'Downgrade';
}

function getPlanRank(plan: HostPlan) {
  return selfServicePlanOptions.indexOf(plan);
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
  const { profile, refreshProfile } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [billingAccount, setBillingAccount] = useState<HostBillingAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshedProfile, setRefreshedProfile] = useState<UserProfile | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<HostPlan>('standard');
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);
  const [isProcessingChange, setIsProcessingChange] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadSubscriptionState() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [rows, account] = await Promise.all([
          listMySubscriptions(),
          getMyHostBillingAccount(),
        ]);
        const nextProfile = await refreshProfile();

        if (!cancelled) {
          setSubscriptions(rows);
          setBillingAccount(account);
          setRefreshedProfile(nextProfile ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load subscriptions.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSubscriptionState();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.status === 'active' || subscription.status === 'grace_period'),
    [subscriptions],
  );
  const activeSelfServiceSubscription = useMemo(
    () => activeSubscriptions[0] ?? null,
    [activeSubscriptions],
  );
  const effectiveProfile = refreshedProfile ?? profile;
  const isManagedHost = effectiveProfile?.managementMode === 'managed';
  const currentAccessLabel = isManagedHost
    ? 'Managed Hosting'
    : activeSelfServiceSubscription
      ? formatPlanLabel(activeSelfServiceSubscription.plan)
      : 'None';

  useEffect(() => {
    if (activeSelfServiceSubscription) {
      setSelectedPlan(activeSelfServiceSubscription.plan);
    }
  }, [activeSelfServiceSubscription]);

  async function handleRefreshState() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [rows, account, nextProfile] = await Promise.all([
        listMySubscriptions(),
        getMyHostBillingAccount(),
        refreshProfile(),
      ]);
      setSubscriptions(rows);
      setBillingAccount(account);
      setRefreshedProfile(nextProfile ?? null);
      if (nextProfile?.hostPlan && !isManagedHost) {
        setSelectedPlan(nextProfile.hostPlan);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not refresh subscriptions.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancelSubscription() {
    if (!activeSelfServiceSubscription) {
      return;
    }

    setIsProcessingCancel(true);
    try {
      const updated = await cancelMySubscription(activeSelfServiceSubscription.id);
      setSubscriptions((current) => current.map((subscription) => (
        subscription.id === updated.id ? updated : subscription
      )));
      await refreshProfile();
      toast.success(`Cancellation scheduled. ${formatPlanLabel(updated.plan)} stays active until ${new Date(updated.endDate).toLocaleDateString()}.`);
      setConfirmCancelOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel the subscription.');
    } finally {
      setIsProcessingCancel(false);
    }
  }

  async function handleChangeSubscription() {
    if (!activeSelfServiceSubscription) {
      return;
    }
    if (selectedPlan === activeSelfServiceSubscription.plan) {
      toast.message('Choose a different plan before continuing.');
      return;
    }

    setIsProcessingChange(true);
    try {
      const payment = await changeMySubscription({
        subscriptionId: activeSelfServiceSubscription.id,
        plan: selectedPlan,
        billingInterval: activeSelfServiceSubscription.billingInterval,
      });
      if (payment.changeType === 'downgrade' && payment.subscription) {
        setSubscriptions((current) => current.map((subscription) => (
          subscription.id === payment.subscription?.id ? payment.subscription : subscription
        )));
        toast.success(`Downgrade scheduled for ${new Date(payment.effectiveAt ?? payment.subscription.endDate).toLocaleDateString()}.`);
        setIsProcessingChange(false);
        return;
      }
      if (payment.payment) {
        window.location.assign(payment.payment.redirectUrl);
        return;
      }
      throw new Error('Subscription change response did not include a checkout or scheduled downgrade.');
    } catch (error) {
      setIsProcessingChange(false);
      toast.error(error instanceof Error ? error.message : 'Could not start the plan change checkout.');
    }
  }

  const scheduledCancellation = activeSelfServiceSubscription?.cancelAtPeriodEnd ?? false;
  const pendingChange = activeSelfServiceSubscription?.pendingPlan
    ? `${formatPlanLabel(activeSelfServiceSubscription.pendingPlan)} ${activeSelfServiceSubscription.pendingBillingInterval ?? activeSelfServiceSubscription.billingInterval}`
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <CreditCard className="h-5 w-5" />
              Subscription Management
            </DialogTitle>
            <DialogDescription>
              Review the live subscription on this host account, schedule cancellation at period end, or move up and down between plans.
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
              <p className="mt-2 text-3xl font-bold text-slate-950">{currentAccessLabel}</p>
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
                This account is on Managed Hosting. In the current system that lane is tracked by account state and
                `managementMode`, not by a normal self-service subscription row. Managed Hosting plan changes still need to be handled through ops.
              </p>
            </div>
          ) : null}

          {!isManagedHost && activeSelfServiceSubscription ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {formatPlanLabel(activeSelfServiceSubscription.plan)}
                    </Badge>
                    <Badge variant="success" className="text-[10px] uppercase">
                      {activeSelfServiceSubscription.billingInterval}
                    </Badge>
                    {scheduledCancellation ? (
                      <Badge variant="warning" className="text-[10px] uppercase">
                        cancels at period end
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-600">
                    Current cycle: {new Date(activeSelfServiceSubscription.startDate).toLocaleDateString()} to {new Date(activeSelfServiceSubscription.endDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatRand(activeSelfServiceSubscription.amount)} / {activeSelfServiceSubscription.billingInterval === 'monthly' ? 'month' : 'year'}
                  </p>
                  {pendingChange ? (
                    <p className="text-sm font-semibold text-amber-700">
                      Pending change: {pendingChange} on {new Date(activeSelfServiceSubscription.pendingChangeEffectiveAt ?? activeSelfServiceSubscription.endDate).toLocaleDateString()}
                    </p>
                  ) : null}
                  {activeSelfServiceSubscription.status === 'grace_period' && activeSelfServiceSubscription.graceEndsAt ? (
                    <p className="text-sm font-semibold text-rose-700">
                      Grace access ends on {new Date(activeSelfServiceSubscription.graceEndsAt).toLocaleDateString()}.
                    </p>
                  ) : null}
                </div>
                <Button variant="outline" onClick={() => void handleRefreshState()} disabled={isLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>

              {scheduledCancellation ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Cancellation is already scheduled. Access stays live until {new Date(activeSelfServiceSubscription.endDate).toLocaleDateString()}, then the plan drops out automatically.
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  If you cancel now, the subscription does not shut off immediately. It stays live through the current billing period and ends on {new Date(activeSelfServiceSubscription.endDate).toLocaleDateString()}.
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Change plan</label>
                  <Select value={selectedPlan} onValueChange={(value) => setSelectedPlan(value as HostPlan)}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Choose a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {selfServicePlanOptions.map((plan) => (
                        <SelectItem key={plan} value={plan}>
                          {formatPlanLabel(plan)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Upgrades are charged only for the rounded unused-time difference. Downgrades are scheduled for the next billing date.
                  </p>
                </div>
                <div className="flex flex-col gap-2 lg:justify-end">
                  <Button
                    onClick={() => void handleChangeSubscription()}
                    disabled={isProcessingChange || selectedPlan === activeSelfServiceSubscription.plan}
                  >
                    {isProcessingChange
                      ? 'Starting checkout...'
                      : `${getChangeButtonLabel(activeSelfServiceSubscription.plan, selectedPlan)} to ${formatPlanLabel(selectedPlan)}${getPlanRank(selectedPlan) > getPlanRank(activeSelfServiceSubscription.plan) ? ' with prorated billing' : ' next cycle'}`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmCancelOpen(true)}
                    disabled={isProcessingCancel || scheduledCancellation}
                  >
                    {scheduledCancellation ? 'Cancellation scheduled' : 'Cancel at period end'}
                  </Button>
                </div>
              </div>
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
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                                {subscription.plan}
                              </Badge>
                              {subscription.cancelAtPeriodEnd ? (
                                <Badge variant="warning" className="text-[10px] uppercase">
                                  ending soon
                                </Badge>
                              ) : null}
                              {subscription.pendingPlan ? (
                                <Badge variant="warning" className="text-[10px] uppercase">
                                  pending {subscription.pendingPlan}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                              ID: {subscription.id}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            variant={
                              subscription.status === 'active'
                                ? subscription.cancelAtPeriodEnd
                                  ? 'warning'
                                  : 'success'
                                : subscription.status === 'grace_period'
                                  ? 'warning'
                                : subscription.status === 'cancelled'
                                  ? 'danger'
                                  : 'secondary'
                            }
                            className="text-[10px] uppercase"
                          >
                            {subscription.status === 'active' && subscription.cancelAtPeriodEnd ? 'active until end date' : subscription.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-slate-900">{formatRand(subscription.amount)}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{subscription.billingInterval}</td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          <p>Start: {new Date(subscription.startDate).toLocaleDateString()}</p>
                          <p>End: {new Date(subscription.endDate).toLocaleDateString()}</p>
                          {subscription.graceEndsAt ? <p>Grace: {new Date(subscription.graceEndsAt).toLocaleDateString()}</p> : null}
                          {subscription.pendingChangeEffectiveAt ? <p>Change: {new Date(subscription.pendingChangeEffectiveAt).toLocaleDateString()}</p> : null}
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

      <ConfirmationDialog
        isOpen={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={() => void handleCancelSubscription()}
        title="Cancel this subscription?"
        description={
          activeSelfServiceSubscription
            ? `This schedules the subscription to end on ${new Date(activeSelfServiceSubscription.endDate).toLocaleDateString()}. Access stays live until then.`
            : 'This schedules the current subscription to end at the end of the billing period.'
        }
        confirmText="Cancel at period end"
        isLoading={isProcessingCancel}
      />
    </>
  );
}
