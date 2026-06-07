import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  ClipboardCheck,
  Home,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type TutorialStep = {
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  required?: boolean;
};

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Secure your host account',
    description: 'Confirm your profile, email, and KYC status so guests and support can trust the person behind the listing.',
    actionLabel: 'Open account settings',
    href: '/account',
    icon: ShieldCheck,
  },
  {
    title: 'Add your banking details',
    description: 'Accommodation payments are handled directly by you. Add EFT or bank-transfer instructions, a clear reference prefix, and proof-of-payment rules before approving enquiries.',
    actionLabel: 'Add payment instructions',
    href: '/account',
    icon: Banknote,
    required: true,
  },
  {
    title: 'Create your first listing',
    description: 'Use strong photos, honest amenities, accurate occupancy, and a realistic nightly rate. Bad listings create support work later. Tiny lecture, useful truth.',
    actionLabel: 'Create listing',
    href: '/host/create-listing',
    icon: Home,
  },
  {
    title: 'Set availability properly',
    description: 'Block dates you cannot host, then let approved holds and confirmed stays reserve nights through the booking workflow.',
    actionLabel: 'Open availability',
    href: '/host/availability',
    icon: CalendarDays,
  },
  {
    title: 'Configure quick replies',
    description: 'Quick replies power the buttons inside booking chat: house rules, directions, payment info, check-in, and checkout. Empty fields still work, but real copy saves time and prevents messy guest instructions.',
    actionLabel: 'Edit quick replies',
    href: '/host/quick-replies',
    icon: MessageSquareText,
    required: true,
  },
  {
    title: 'Work the enquiry queue',
    description: 'Approve only when the dates and price are right. Decline with a reason. After approval, watch payment proof and confirmation deadlines.',
    actionLabel: 'Open enquiries',
    href: '/host/enquiries',
    icon: ClipboardCheck,
  },
];

export default function HostOnboardingTutorial() {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Host setup
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
                Get your hosting workspace ready before guests start asking questions.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
                This tutorial walks through the parts new hosts usually miss: direct payment instructions, quick replies, listing setup, availability, and enquiry handling.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/account" className={cn(buttonVariants({ variant: 'default' }), 'rounded-full')}>
                Add banking details <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link to="/host/quick-replies" className={cn(buttonVariants({ variant: 'outline' }), 'rounded-full')}>
                Set quick replies
              </Link>
            </div>
          </div>
          <Card className="border-primary/15 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-2">
                <h2 className="text-base font-bold">Do these first</h2>
                <p className="text-sm leading-6 text-on-surface-variant">
                  Banking details and quick replies are not decoration. They drive direct guest payment coordination and booking chat shortcuts.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {tutorialSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Card key={step.title} className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                      Step {index + 1}
                    </span>
                    {step.required ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                        Required setup
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-on-surface">{step.title}</h2>
                    <p className="text-sm leading-6 text-on-surface-variant">{step.description}</p>
                  </div>
                  <Link
                    to={step.href}
                    className={cn(buttonVariants({ variant: step.required ? 'default' : 'outline' }), 'rounded-full')}
                  >
                    {step.actionLabel} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <Card className="p-6">
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="text-xl font-bold">How quick replies actually work</h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Booking chat shows context-aware actions based on the booking stage. Hosts can send house rules early, payment information after approval, and arrival instructions once the stay is confirmed.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {['House rules', 'Payment info', 'Directions', 'Check-in', 'Checkout'].map((label) => (
              <div key={label} className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface">
                {label}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <p className="text-xs text-on-surface-variant">Signed: (|/) Klaasvaakie</p>
    </div>
  );
}
