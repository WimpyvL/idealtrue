import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ImageIcon,
  Loader2,
  Megaphone,
  PencilLine,
  Send,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { useAuth } from '../contexts/AuthContext';
import { Listing } from '../types';
import {
  ContentDraft,
  ContentEntitlements,
  generateContentDraft,
  getBillingPaymentStatus,
  getCheckoutStatus,
  getContentEntitlements,
  listContentDrafts,
  startBillingPayment,
  updateContentDraft,
} from '../lib/billing-client';
import { generateListingSocialCreative, type GeneratedSocialCreative } from '../lib/ai-client';
import {
  getPlatformLabel,
  getSocialTemplate,
  SOCIAL_PLATFORMS,
  SOCIAL_TEMPLATES,
  type SocialPlatform,
  type SocialTemplateId,
  type SocialTone,
} from '../lib/social-content';

// Author: Klaasvaakie ( |╲ )
const CREDIT_PACKS = [10, 25, 50];

type MarketingView = 'create' | 'drafts' | 'calendar';
type MarketingGoal = 'bookings' | 'offer' | 'showcase' | 'quiet_period';

const MARKETING_VIEWS: Array<{ id: MarketingView; label: string; description: string }> = [
  { id: 'create', label: 'Create Post', description: 'Build a publish-ready post' },
  { id: 'drafts', label: 'Drafts', description: 'Review and refine content' },
  { id: 'calendar', label: 'Calendar', description: 'Track distribution' },
];

const MARKETING_GOALS: Array<{
  id: MarketingGoal;
  label: string;
  description: string;
  templateId: SocialTemplateId;
  tone: SocialTone;
}> = [
  { id: 'bookings', label: 'Get more bookings', description: 'Lead with the stay, its strongest features and a clear booking action.', templateId: 'featured_stay', tone: 'professional' },
  { id: 'offer', label: 'Promote an offer', description: 'Put a discount, last-minute opening or limited deal at the centre.', templateId: 'special_offer', tone: 'urgent' },
  { id: 'showcase', label: 'Showcase the stay', description: 'Sell the atmosphere with an image-led, experience-first story.', templateId: 'lifestyle_escape', tone: 'luxurious' },
  { id: 'quiet_period', label: 'Fill a quiet period', description: 'Create a timely short-break hook for open dates.', templateId: 'weekend_escape', tone: 'adventurous' },
];

function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function getDraftLifecycleDate(draft: ContentDraft) {
  if (draft.status === 'published') return draft.publishedAt ?? null;
  if (draft.status === 'scheduled') return draft.scheduledFor ?? null;
  return null;
}

function formatDraftLifecycleDate(draft: ContentDraft) {
  const lifecycleDate = getDraftLifecycleDate(draft);
  return lifecycleDate ? new Date(lifecycleDate).toLocaleString() : 'No distribution date set';
}

function getDraftStatusLabel(draft: ContentDraft) {
  if (draft.status === 'published') return 'Published';
  if (draft.status === 'scheduled') return 'Scheduled';
  return 'Draft';
}

function resolveView(value: string | null): MarketingView {
  if (value === 'drafts' || value === 'calendar') return value;
  return 'create';
}

export default function SocialDashboard({ listings }: { listings: Listing[] }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const listingIdFromUrl = searchParams.get('listingId');

  const [selectedGoalId, setSelectedGoalId] = useState<MarketingGoal>('bookings');
  const [selectedTemplateId, setSelectedTemplateId] = useState<SocialTemplateId>('featured_stay');
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [tone, setTone] = useState<SocialTone>('professional');
  const [includePrice, setIncludePrice] = useState(true);
  const [includeSpecialOffer, setIncludeSpecialOffer] = useState(false);
  const [customHeadline, setCustomHeadline] = useState('');
  const [creativeSourceUrl, setCreativeSourceUrl] = useState<string | null>(null);
  const [generatedCreative, setGeneratedCreative] = useState<GeneratedSocialCreative | null>(null);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [entitlements, setEntitlements] = useState<ContentEntitlements | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [purchasingCredits, setPurchasingCredits] = useState<number | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const activeView = resolveView(searchParams.get('tool'));
  const selectedListing = useMemo(() => {
    if (listings.length === 0) return null;
    if (listingIdFromUrl) return listings.find((listing) => listing.id === listingIdFromUrl) ?? listings[0];
    return listings[0];
  }, [listingIdFromUrl, listings]);
  const selectedTemplate = useMemo(() => getSocialTemplate(selectedTemplateId), [selectedTemplateId]);
  const selectedDraft = useMemo(() => drafts.find((draft) => draft.id === selectedDraftId) ?? null, [drafts, selectedDraftId]);
  const canScheduleDraft = Boolean(entitlements?.canSchedule && scheduleAt && !Number.isNaN(new Date(scheduleAt).getTime()));
  const scheduledDrafts = useMemo(
    () => drafts.filter((draft) => draft.status !== 'draft').sort((a, b) => {
      const left = getDraftLifecycleDate(a) ?? a.updatedAt;
      const right = getDraftLifecycleDate(b) ?? b.updatedAt;
      return new Date(left).getTime() - new Date(right).getTime();
    }),
    [drafts],
  );

  useEffect(() => {
    if (!selectedTemplate.supportedPlatforms.includes(platform)) setPlatform(selectedTemplate.supportedPlatforms[0]);
    if (!selectedTemplate.supportsSpecialOffer) setIncludeSpecialOffer(false);
    if (!selectedTemplate.supportsHeadlineOverride) setCustomHeadline('');
  }, [platform, selectedTemplate]);

  useEffect(() => {
    setCreativeSourceUrl(selectedListing?.images?.[0] ?? null);
    setGeneratedCreative(null);
  }, [selectedListing]);

  useEffect(() => {
    if (!selectedDraft) {
      setEditorContent('');
      setScheduleAt('');
      return;
    }
    setEditorContent(selectedDraft.content);
    setScheduleAt(selectedDraft.scheduledFor ? selectedDraft.scheduledFor.slice(0, 16) : '');
  }, [selectedDraft]);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      if (!profile || profile.role !== 'host') return;
      const [nextEntitlements, nextDrafts] = await Promise.all([getContentEntitlements(), listContentDrafts()]);
      if (cancelled) return;
      setEntitlements(nextEntitlements);
      setDrafts(nextDrafts);
      setSelectedDraftId((current) => current ?? nextDrafts[0]?.id ?? null);
    }
    void loadWorkspace().catch((error) => console.error('Failed to load content workspace', error));
    return () => { cancelled = true; };
  }, [profile]);

  useEffect(() => {
    const billingStatus = searchParams.get('billing_status');
    const checkoutId = searchParams.get('checkout_id');
    const paymentId = searchParams.get('payment_id');
    if (!profile || !billingStatus || (!paymentId && !checkoutId)) return;
    const statusRequest = paymentId ? getBillingPaymentStatus(paymentId, billingStatus) : getCheckoutStatus(checkoutId!);
    void statusRequest.then(async (result) => {
      const paymentKind = 'purpose' in result ? result.purpose : result.checkoutType;
      if (paymentKind === 'content_credits' && result.status === 'paid') {
        setEntitlements(await getContentEntitlements());
        toast.success('Credit top-up confirmed. Your content wallet has been updated.');
      }
    }).catch((error) => console.error('Failed to resolve content checkout', error));
  }, [profile, searchParams]);

  const contentEnabled = entitlements?.contentStudioEnabled ?? false;

  function setActiveView(view: MarketingView) {
    const next = new URLSearchParams(searchParams);
    if (view === 'create') next.delete('tool');
    else next.set('tool', view);
    setSearchParams(next, { replace: true });
  }

  function applyGoal(goalId: MarketingGoal) {
    const goal = MARKETING_GOALS.find((item) => item.id === goalId) ?? MARKETING_GOALS[0];
    setSelectedGoalId(goal.id);
    setSelectedTemplateId(goal.templateId);
    setTone(goal.tone);
    setIncludeSpecialOffer(goal.id === 'offer');
  }

  async function handleTopUpCredits(credits: number) {
    setPurchasingCredits(credits);
    try {
      const payment = await startBillingPayment({ purpose: 'content_credits', credits });
      window.location.assign(payment.redirectUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Credit purchase failed.');
    } finally {
      setPurchasingCredits(null);
    }
  }

  async function handleGeneratePostSet() {
    if (!selectedListing || !creativeSourceUrl) return;
    setIsGenerating(true);
    try {
      const [draftResult, creativeResult] = await Promise.allSettled([
        generateContentDraft(selectedListing, platform, tone, selectedTemplateId, { includePrice, includeSpecialOffer, customHeadline }),
        generateListingSocialCreative({
          listingId: selectedListing.id,
          sourceImageUrl: creativeSourceUrl,
          platform,
          tone,
          templateId: selectedTemplateId,
          includePrice,
          includeSpecialOffer,
          customHeadline,
        }),
      ]);
      if (draftResult.status === 'fulfilled') {
        setDrafts((current) => [draftResult.value.draft, ...current]);
        setEntitlements(draftResult.value.entitlements);
        setSelectedDraftId(draftResult.value.draft.id);
      }
      if (creativeResult.status === 'fulfilled') setGeneratedCreative(creativeResult.value);
      if (draftResult.status === 'rejected') throw draftResult.reason;
      if (creativeResult.status === 'rejected') toast.error(creativeResult.reason instanceof Error ? creativeResult.reason.message : 'Visual pack generation failed.');
      else toast.success('Post set generated and saved to drafts.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate post set.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveDraft(status: ContentDraft['status']) {
    if (!selectedDraft) return;
    setIsSavingDraft(true);
    try {
      const updatedDraft = await updateContentDraft({
        draftId: selectedDraft.id,
        content: editorContent,
        status,
        scheduledFor: status === 'scheduled' ? new Date(scheduleAt).toISOString() : null,
      });
      setDrafts((current) => current.map((draft) => draft.id === updatedDraft.id ? updatedDraft : draft));
      toast.success(status === 'scheduled' ? 'Distribution reminder scheduled.' : status === 'published' ? 'Manual publication recorded.' : 'Draft saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the draft.');
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function copyDraft() {
    if (!editorContent) return;
    await navigator.clipboard.writeText(editorContent);
    setCopiedDraft(true);
    window.setTimeout(() => setCopiedDraft(false), 2000);
  }

  async function copyCaption() {
    if (!generatedCreative?.caption) return;
    await navigator.clipboard.writeText(generatedCreative.caption);
    setCopiedCaption(true);
    window.setTimeout(() => setCopiedCaption(false), 2000);
  }

  if (!profile || profile.role !== 'host') return <div className="text-on-surface-variant">This workspace is only available for hosts.</div>;

  return (
    <div className="min-w-0 space-y-6 pb-10">
      <header className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest shadow-[0_16px_40px_rgba(18,28,42,0.06)]">
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Marketing workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Turn your stay into a post worth sharing.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">Choose the result you want. Ideal Stay handles the content format, tone and visual structure.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger className="inline-flex h-10 items-center rounded-full border border-outline-variant bg-surface px-4 text-sm font-semibold hover:bg-surface-container-low">
                <WalletCards className="mr-2 h-4 w-4 text-primary" />
                {entitlements?.remainingIncludedDrafts ?? '...'} included left
                <ChevronDown className="ml-2 h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Content wallet</p>
                <p className="mt-2 text-3xl font-bold">{entitlements?.creditBalance ?? '...'}</p>
                <p className="text-xs text-on-surface-variant">Purchased credits available</p>
                <div className="mt-4 flex gap-2">
                  {CREDIT_PACKS.map((credits) => (
                    <button key={credits} type="button" aria-label={`Buy ${credits} content tokens`} disabled={purchasingCredits !== null} onClick={() => void handleTopUpCredits(credits)} className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold hover:border-primary hover:text-primary">
                      {purchasingCredits === credits ? '...' : `+${credits}`}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" className="rounded-full" onClick={() => navigate('/pricing?audience=host')}>Manage Plan</Button>
          </div>
        </div>

        <nav className="grid border-t border-outline-variant sm:grid-cols-3" aria-label="Marketing workspace sections">
          {MARKETING_VIEWS.map((view) => {
            const active = activeView === view.id;
            return (
              <button key={view.id} type="button" onClick={() => setActiveView(view.id)} className={`flex items-center gap-3 border-b border-outline-variant px-5 py-4 text-left transition sm:border-b-0 sm:border-r sm:last:border-r-0 ${active ? 'bg-primary/10 text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
                {view.id === 'create' ? <Sparkles className="h-5 w-5 text-primary" /> : view.id === 'drafts' ? <PencilLine className="h-5 w-5 text-primary" /> : <CalendarDays className="h-5 w-5 text-primary" />}
                <span><span className="block font-bold">{view.label}</span><span className="block text-xs font-normal">{view.description}</span></span>
              </button>
            );
          })}
        </nav>
      </header>

      {activeView === 'create' ? (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <Card className="space-y-7 rounded-3xl p-5 sm:p-7">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Create post</p><h2 className="mt-2 text-2xl font-bold">Three choices. Then generate.</h2></div>

            <section className="space-y-3">
              <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-inverse-surface text-sm font-bold text-white">1</span><div><h3 className="font-bold">Choose the property</h3><p className="text-sm text-on-surface-variant">The listing supplies the facts, images and booking link.</p></div></div>
              <select value={selectedListing?.id ?? ''} onChange={(event) => { const next = new URLSearchParams(searchParams); next.set('listingId', event.target.value); setSearchParams(next, { replace: true }); }} className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                {listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}
              </select>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-inverse-surface text-sm font-bold text-white">2</span><div><h3 className="font-bold">What should this post achieve?</h3><p className="text-sm text-on-surface-variant">We choose the right format and tone from your goal.</p></div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {MARKETING_GOALS.map((goal) => (
                  <button key={goal.id} type="button" onClick={() => applyGoal(goal.id)} aria-pressed={selectedGoalId === goal.id} className={`rounded-2xl border p-4 text-left transition ${selectedGoalId === goal.id ? 'border-primary bg-primary/5 shadow-[0_8px_24px_rgba(8,168,200,0.12)]' : 'border-outline-variant hover:border-primary/60'}`}>
                    <span className="font-bold">{goal.label}</span><span className="mt-1 block text-sm leading-5 text-on-surface-variant">{goal.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-inverse-surface text-sm font-bold text-white">3</span><div><h3 className="font-bold">Where will you share it?</h3><p className="text-sm text-on-surface-variant">Only compatible channels are available for the selected format.</p></div></div>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PLATFORMS.map((item) => {
                  const supported = selectedTemplate.supportedPlatforms.includes(item.id);
                  return <button key={item.id} type="button" disabled={!supported} onClick={() => setPlatform(item.id)} aria-pressed={platform === item.id} title={supported ? undefined : `Not available for ${selectedTemplate.name}`} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${platform === item.id ? 'border-primary bg-primary text-white' : supported ? 'border-outline-variant hover:border-primary' : 'cursor-not-allowed border-transparent bg-surface-container-high text-on-surface-variant/55'}`}>{item.label}</button>;
                })}
              </div>
            </section>

            <details className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
              <summary className="cursor-pointer font-bold">Fine-tune the post <span className="ml-2 text-sm font-normal text-on-surface-variant">Optional</span></summary>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold">Template<select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value as SocialTemplateId)} className="h-11 w-full rounded-xl border border-outline-variant bg-white px-3 font-normal">{SOCIAL_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
                <label className="space-y-2 text-sm font-semibold">Tone<select value={tone} onChange={(event) => setTone(event.target.value as SocialTone)} className="h-11 w-full rounded-xl border border-outline-variant bg-white px-3 font-normal"><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="adventurous">Adventurous</option><option value="luxurious">Luxurious</option><option value="urgent">Urgent</option></select></label>
                <label className="space-y-2 text-sm font-semibold sm:col-span-2">Campaign hook<Input value={customHeadline} onChange={(event) => setCustomHeadline(event.target.value)} disabled={!selectedTemplate.supportsHeadlineOverride} placeholder={selectedTemplate.supportsHeadlineOverride ? 'Optional headline or campaign hook' : 'This format creates its own headline'} /></label>
                <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={includePrice} onChange={(event) => setIncludePrice(event.target.checked)} className="h-4 w-4 accent-primary" />Include price</label>
                <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={includeSpecialOffer} disabled={!selectedTemplate.supportsSpecialOffer} onChange={(event) => setIncludeSpecialOffer(event.target.checked)} className="h-4 w-4 accent-primary" />Include special offer</label>
              </div>
            </details>

            <Button size="lg" className="h-14 w-full rounded-2xl text-base font-bold" onClick={handleGeneratePostSet} disabled={!selectedListing || !creativeSourceUrl || isGenerating || !contentEnabled}>
              {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              Generate post set · 1 credit
            </Button>
          </Card>

          <div className="space-y-6">
            <Card className="overflow-hidden rounded-3xl p-0">
              <div className="border-b border-outline-variant p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Creative source</p><h2 className="mt-1 text-xl font-bold">{selectedListing?.title ?? 'Choose a property'}</h2></div>
              {creativeSourceUrl ? <img src={creativeSourceUrl} alt={`Selected creative for ${selectedListing?.title ?? 'listing'}`} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-surface-container-low text-on-surface-variant"><ImageIcon className="mr-2 h-5 w-5" />No listing image</div>}
              {selectedListing?.images?.length ? <div className="flex gap-2 overflow-x-auto p-4">{selectedListing.images.map((image, index) => <button key={image} type="button" aria-label={`Select listing image ${index + 1}`} onClick={() => setCreativeSourceUrl(image)} className={`shrink-0 overflow-hidden rounded-xl border-2 ${creativeSourceUrl === image ? 'border-primary' : 'border-transparent'}`}><img src={image} alt="" className="h-16 w-20 object-cover" /></button>)}</div> : null}
            </Card>

            <Card className="rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Generated post</p><h2 className="mt-1 text-xl font-bold">Preview</h2></div>{generatedCreative ? <button type="button" onClick={copyCaption} className="rounded-full border border-outline-variant px-3 py-2 text-sm font-semibold">{copiedCaption ? 'Copied' : 'Copy caption'}</button> : null}</div>
              {generatedCreative ? <div className="mt-4 space-y-4"><p className="text-sm leading-6 text-on-surface-variant">{generatedCreative.caption}</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{generatedCreative.assets.map((asset) => <div key={asset.id} className="overflow-hidden rounded-2xl border border-outline-variant"><img src={asset.dataUrl} alt={asset.label} className="w-full object-cover" /><button type="button" onClick={() => downloadDataUrl(asset.fileName, asset.dataUrl)} className="flex w-full items-center justify-center gap-2 p-3 text-sm font-semibold hover:bg-surface-container-low"><Download className="h-4 w-4" />Download {asset.label}</button></div>)}</div></div> : <div className="mt-4 rounded-2xl border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant"><Megaphone className="mx-auto mb-3 h-8 w-8 text-primary" />Your caption and visual pack will appear here.</div>}
            </Card>
          </div>
        </div>
      ) : null}

      {activeView === 'drafts' ? (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="rounded-3xl p-4"><div className="p-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Draft library</p><h2 className="mt-1 text-2xl font-bold">Ready for review</h2></div><div className="mt-3 max-h-[680px] space-y-2 overflow-y-auto">{drafts.length ? drafts.map((draft) => <button key={draft.id} type="button" onClick={() => setSelectedDraftId(draft.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedDraftId === draft.id ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}><div className="flex items-start justify-between gap-3"><span className="font-bold">{draft.listingTitle}</span><span className="rounded-full bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase">{getDraftStatusLabel(draft)}</span></div><p className="mt-1 text-xs text-on-surface-variant">{draft.templateName} · {getPlatformLabel(draft.platform)}</p></button>) : <div className="rounded-2xl border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">Create your first post to start the draft library.</div>}</div></Card>
          <Card className="rounded-3xl p-5 sm:p-7">{selectedDraft ? <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Edit draft</p><h2 className="mt-1 text-2xl font-bold">{selectedDraft.listingTitle}</h2><p className="text-sm text-on-surface-variant">{selectedDraft.templateName} · {getPlatformLabel(selectedDraft.platform)} · {selectedDraft.tone}</p></div><button type="button" onClick={copyDraft} className="flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold">{copiedDraft ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}{copiedDraft ? 'Copied' : 'Copy draft'}</button></div><textarea aria-label="Draft content" className="min-h-[300px] w-full rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-sm leading-6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" value={editorContent} onChange={(event) => setEditorContent(event.target.value)} /><div className="grid gap-4 lg:grid-cols-[1fr_auto]"><label className="space-y-2 text-sm font-semibold"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />Distribution reminder</span><Input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} disabled={!entitlements?.canSchedule} /></label><div className="flex flex-wrap items-end gap-2"><Button variant="outline" disabled={isSavingDraft} onClick={() => handleSaveDraft('draft')}>Save draft</Button><Button variant="outline" disabled={!canScheduleDraft || isSavingDraft} onClick={() => handleSaveDraft('scheduled')}><Send className="mr-2 h-4 w-4" />Schedule reminder</Button><Button disabled={isSavingDraft} onClick={() => handleSaveDraft('published')}>Record as published</Button></div></div><div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5"><Markdown>{editorContent}</Markdown></div></div> : <div className="flex min-h-[420px] items-center justify-center text-center text-on-surface-variant"><div><PencilLine className="mx-auto mb-3 h-9 w-9 text-primary" /><p className="font-semibold">Choose a draft to review it.</p></div></div>}</Card>
        </div>
      ) : null}

      {activeView === 'calendar' ? (
        <Card className="rounded-3xl p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Distribution calendar</p><h2 className="mt-1 text-3xl font-bold">Know what goes out next.</h2><p className="mt-1 text-sm text-on-surface-variant">These are reminders and manual publication records—not direct social publishing.</p></div><Button className="rounded-full" onClick={() => setActiveView('create')}><Sparkles className="mr-2 h-4 w-4" />Create post</Button></div><div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{scheduledDrafts.length ? scheduledDrafts.map((draft) => <article key={draft.id} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"><div className="flex items-start justify-between gap-3"><CalendarDays className="h-5 w-5 text-primary" /><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${draft.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-primary/10 text-primary'}`}>{getDraftStatusLabel(draft)}</span></div><h3 className="mt-5 font-bold">{draft.listingTitle}</h3><p className="mt-1 text-sm text-on-surface-variant">{getPlatformLabel(draft.platform)} · {draft.templateName}</p><p className="mt-4 text-sm font-semibold">{formatDraftLifecycleDate(draft)}</p><button type="button" onClick={() => { setSelectedDraftId(draft.id); setActiveView('drafts'); }} className="mt-4 text-sm font-bold text-primary hover:underline">Open draft</button></article>) : <div className="col-span-full rounded-2xl border border-dashed border-outline-variant p-12 text-center"><CalendarDays className="mx-auto mb-3 h-10 w-10 text-primary" /><h3 className="font-bold">No distribution activity yet</h3><p className="mt-1 text-sm text-on-surface-variant">Schedule a reminder from a draft when the post is ready.</p></div>}</div></Card>
      ) : null}
    </div>
  );
}
