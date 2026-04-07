import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Copy, Download, LayoutTemplate, Loader2, Send, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { Listing } from '../types';
import {
  createContentCreditsCheckout,
  ContentDraft,
  ContentEntitlements,
  generateContentDraft,
  getCheckoutStatus,
  getContentEntitlements,
  listContentDrafts,
  updateContentDraft,
} from '../lib/billing-client';
import { generateListingSocialCreative, type GeneratedSocialCreative } from '../lib/ai-client';
import { getPlatformLabel, getSocialTemplate, SOCIAL_PLATFORMS, SOCIAL_TEMPLATES, type SocialPlatform, type SocialTemplateId, type SocialTone } from '../lib/social-content';

const CREDIT_PACKS = [10, 25, 50];

function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export default function SocialDashboard({ listings }: { listings: Listing[] }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const listingIdFromUrl = searchParams.get('listingId');

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
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
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const selectedTemplate = useMemo(() => getSocialTemplate(selectedTemplateId), [selectedTemplateId]);
  const selectedDraft = useMemo(() => drafts.find((draft) => draft.id === selectedDraftId) ?? null, [drafts, selectedDraftId]);

  useEffect(() => {
    if (listingIdFromUrl && listings.length > 0) {
      setSelectedListing(listings.find((listing) => listing.id === listingIdFromUrl) ?? listings[0]);
      return;
    }
    if (!selectedListing && listings.length > 0) {
      setSelectedListing(listings[0]);
    }
  }, [listingIdFromUrl, listings, selectedListing]);

  useEffect(() => {
    if (!selectedTemplate.supportedPlatforms.includes(platform)) {
      setPlatform(selectedTemplate.supportedPlatforms[0]);
    }
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
      if (!selectedDraftId && nextDrafts.length > 0) setSelectedDraftId(nextDrafts[0].id);
    }
    void loadWorkspace().catch((error) => console.error('Failed to load content workspace', error));
    return () => {
      cancelled = true;
    };
  }, [profile, selectedDraftId]);

  useEffect(() => {
    const billingStatus = searchParams.get('billing_status');
    const checkoutId = searchParams.get('checkout_id');
    if (!profile || !billingStatus || !checkoutId) return;

    void getCheckoutStatus(checkoutId)
      .then(async (result) => {
        if (result.checkoutType !== 'content_credits') return;
        if (result.status === 'paid') {
          setEntitlements(await getContentEntitlements());
          toast.success('Credit top-up confirmed. Your content wallet has been updated.');
        }
      })
      .catch((error) => console.error('Failed to resolve content checkout', error));
  }, [profile, searchParams]);

  const contentEnabled = entitlements?.contentStudioEnabled ?? false;

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
      if (creativeResult.status === 'fulfilled') {
        setGeneratedCreative(creativeResult.value);
      }
      if (draftResult.status === 'rejected') throw draftResult.reason;
      if (creativeResult.status === 'rejected') {
        toast.error(creativeResult.reason instanceof Error ? creativeResult.reason.message : 'Visual pack generation failed.');
      } else {
        toast.success('Template post set generated.');
      }
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
      setSelectedDraftId(updatedDraft.id);
      toast.success(status === 'scheduled' ? 'Draft scheduled.' : status === 'published' ? 'Draft marked as published.' : 'Draft saved.');
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
    setTimeout(() => setCopiedDraft(false), 2000);
  }

  async function copyCaption() {
    if (!generatedCreative?.caption) return;
    await navigator.clipboard.writeText(generatedCreative.caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  }

  if (!profile || profile.role !== 'host') {
    return <div className="text-on-surface-variant">This workspace is only available for hosts.</div>;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Content Studio</h1>
        <p className="text-on-surface-variant">Choose the property, template, platform, and tone. The system builds the post set.</p>
      </header>

      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">Entitlements</p>
            <h2 className="text-2xl font-bold">Plan-backed content access</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate('/pricing?audience=host')}>Manage Plan</Button>
            {CREDIT_PACKS.map((credits) => (
              <Button key={credits} variant="outline" onClick={() => createContentCreditsCheckout(credits).then((checkout) => window.location.assign(checkout.redirectUrl)).catch((error) => toast.error(error instanceof Error ? error.message : 'Credit purchase failed.'))}>
                Buy {credits} credits
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-outline-variant p-4"><p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Plan</p><p className="mt-2 text-2xl font-bold capitalize">{entitlements?.plan ?? '...'}</p></div>
          <div className="rounded-2xl border border-outline-variant p-4"><p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Included left</p><p className="mt-2 text-2xl font-bold">{entitlements?.remainingIncludedDrafts ?? '...'}</p></div>
          <div className="rounded-2xl border border-outline-variant p-4"><p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Used this month</p><p className="mt-2 text-2xl font-bold">{entitlements?.usedDraftsThisMonth ?? '...'}</p></div>
          <div className="rounded-2xl border border-outline-variant p-4"><p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Credits</p><p className="mt-2 text-2xl font-bold">{entitlements?.creditBalance ?? '...'}</p></div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2"><LayoutTemplate className="w-5 h-5" /><h2 className="text-xl font-bold">Post set setup</h2></div>
          <p className="text-sm text-on-surface-variant">Hosts do not design here. They only choose the inputs.</p>
          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
            {listings.map((listing) => (
              <button key={listing.id} onClick={() => setSelectedListing(listing)} className={`w-full rounded-2xl border p-3 text-left ${selectedListing?.id === listing.id ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}>
                <div className="flex items-center gap-3">
                  <img src={listing.images[0] || `https://picsum.photos/seed/${listing.id}/100/100`} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{listing.title}</p>
                    <p className="truncate text-xs text-on-surface-variant">{listing.location}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <div className="grid gap-3 lg:grid-cols-3">
            {SOCIAL_TEMPLATES.map((template) => (
              <button key={template.id} onClick={() => setSelectedTemplateId(template.id)} className={`rounded-2xl border p-4 text-left ${selectedTemplateId === template.id ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}>
                <p className="font-semibold">{template.name}</p>
                <p className="mt-2 text-sm text-on-surface-variant">{template.shortDescription}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            {SOCIAL_PLATFORMS.map((item) => (
              <button key={item.id} disabled={!selectedTemplate.supportedPlatforms.includes(item.id)} onClick={() => setPlatform(item.id)} className={`rounded-xl border px-4 py-2 text-sm font-medium ${platform === item.id ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant'} ${selectedTemplate.supportedPlatforms.includes(item.id) ? '' : 'opacity-40 cursor-not-allowed'}`}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(['professional', 'friendly', 'adventurous', 'luxurious', 'urgent'] as const).map((item) => (
              <button key={item} onClick={() => setTone(item)} className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${tone === item ? 'bg-gradient-to-r from-slate-900 to-blue-600 text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
                {item}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="rounded-2xl border border-outline-variant p-4 flex items-center justify-between gap-4"><span>Include price</span><input type="checkbox" checked={includePrice} onChange={(event) => setIncludePrice(event.target.checked)} className="h-5 w-5 accent-primary" /></label>
            <label className={`rounded-2xl border border-outline-variant p-4 flex items-center justify-between gap-4 ${selectedTemplate.supportsSpecialOffer ? '' : 'opacity-50'}`}><span>Include special offer</span><input type="checkbox" checked={includeSpecialOffer} onChange={(event) => setIncludeSpecialOffer(event.target.checked)} disabled={!selectedTemplate.supportsSpecialOffer} className="h-5 w-5 accent-primary" /></label>
          </div>

          <Input value={customHeadline} onChange={(event) => setCustomHeadline(event.target.value)} placeholder={selectedTemplate.supportsHeadlineOverride ? 'Optional headline override' : 'Template uses system headline'} disabled={!selectedTemplate.supportsHeadlineOverride} />

          {selectedListing?.images?.length ? (
            <div className="grid grid-cols-3 gap-3">
              {selectedListing.images.map((imageUrl) => (
                <button key={imageUrl} onClick={() => { setCreativeSourceUrl(imageUrl); setGeneratedCreative(null); }} className={`overflow-hidden rounded-2xl border ${creativeSourceUrl === imageUrl ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`}>
                  <img src={imageUrl} alt="" className="aspect-square w-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          ) : null}

          <Button className="h-14 rounded-xl text-lg font-bold" disabled={!selectedListing || !creativeSourceUrl || isGenerating || !contentEnabled} onClick={handleGeneratePostSet}>
            {isGenerating ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Building post set...</> : <><Sparkles className="mr-2 h-5 w-5" />Generate Post Set</>}
          </Button>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="text-2xl font-bold">Visual pack</h2><p className="text-sm text-on-surface-variant">{generatedCreative?.templateName ?? selectedTemplate.name}</p></div>
            {generatedCreative?.assets?.length ? <Button variant="outline" onClick={() => generatedCreative.assets.forEach((asset) => downloadDataUrl(asset.fileName, asset.dataUrl))}><Download className="mr-2 h-4 w-4" />Download all</Button> : null}
          </div>
          {generatedCreative ? (
            <>
              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">{generatedCreative.templateName}</p><h3 className="text-2xl font-bold">{generatedCreative.headline}</h3></div>
                  <button onClick={copyCaption} className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm">{copiedCaption ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}{copiedCaption ? 'Copied!' : 'Copy caption'}</button>
                </div>
                <p className="mt-3 text-sm text-on-surface-variant">{generatedCreative.caption}</p>
                <p className="mt-2 text-xs text-on-surface-variant">Booking link: {generatedCreative.bookingUrl}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {generatedCreative.assets.map((asset) => (
                  <div key={asset.id} className="space-y-2">
                    <div className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest"><img src={asset.dataUrl} alt={asset.label} className="w-full object-cover" /></div>
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="font-semibold">{asset.label}</p><p className="text-xs text-on-surface-variant">{asset.width} × {asset.height}</p></div>
                      <Button variant="outline" size="sm" onClick={() => downloadDataUrl(asset.fileName, asset.dataUrl)}><Download className="mr-2 h-4 w-4" />Download</Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="rounded-2xl border border-dashed border-outline-variant p-10 text-center text-on-surface-variant">Generate a post set to preview the overlay pack here.</div>}
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="text-2xl font-bold">Draft editor</h2><p className="text-sm text-on-surface-variant">Edit the generated copy and publish when ready.</p></div>
            <button onClick={copyDraft} disabled={!selectedDraft} className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm">{copiedDraft ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}{copiedDraft ? 'Copied!' : 'Copy draft'}</button>
          </div>

          <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2">
            {drafts.map((draft) => (
              <button key={draft.id} onClick={() => setSelectedDraftId(draft.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedDraftId === draft.id ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div><p className="font-semibold">{draft.listingTitle}</p><p className="text-xs text-on-surface-variant">{draft.templateName} • {getPlatformLabel(draft.platform)} • {draft.tone}</p></div>
                  <span className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">{draft.status}</span>
                </div>
              </button>
            ))}
          </div>

          {!selectedDraft ? <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">Pick a draft to edit it.</div> : (
            <>
              <textarea className="min-h-[240px] w-full rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={editorContent} onChange={(event) => setEditorContent(event.target.value)} />
              <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4" />Schedule distribution</label>
                  <Input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} disabled={!entitlements?.canSchedule} />
                </div>
                <Button variant="outline" disabled={isSavingDraft} onClick={() => handleSaveDraft('draft')}>{isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Draft'}</Button>
                <div className="flex gap-3">
                  <Button variant="outline" disabled={!scheduleAt || !entitlements?.canSchedule || isSavingDraft} onClick={() => handleSaveDraft('scheduled')}><Send className="mr-2 h-4 w-4" />Schedule</Button>
                  <Button disabled={isSavingDraft} onClick={() => handleSaveDraft('published')}>Publish Logged</Button>
                </div>
              </div>
              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4"><Markdown>{editorContent}</Markdown></div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
