import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronDown, Copy, Download, LayoutTemplate, Loader2, Send, Sparkles, WalletCards } from 'lucide-react';
import Markdown from 'react-markdown';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
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

type IdeaModeId = 'brand_new' | 'content_pillars' | 'start_with_image' | 'custom_idea';
type GeneratorModeId = 'trending_topics' | 'evergreen_ideas' | 'viral_hooks' | 'surprise_me';

const IDEA_MODES: Array<{
  id: IdeaModeId;
  title: string;
  description: string;
  templateId: SocialTemplateId;
  tone: SocialTone;
}> = [
  {
    id: 'brand_new',
    title: 'Brand new ideas',
    description: 'Generate fresh post angles from your listing and market positioning.',
    templateId: 'featured_stay',
    tone: 'professional',
  },
  {
    id: 'content_pillars',
    title: 'Your content pillars',
    description: 'Use repeatable stay themes like family, weekend, luxury, and value.',
    templateId: 'stay_carousel',
    tone: 'friendly',
  },
  {
    id: 'start_with_image',
    title: 'Start with an image',
    description: 'Build the idea around the selected listing photo and visual pack.',
    templateId: 'story_pack',
    tone: 'luxurious',
  },
  {
    id: 'custom_idea',
    title: 'Custom idea',
    description: 'Guide the engine with your own hook, campaign, or offer angle.',
    templateId: 'weekend_escape',
    tone: 'adventurous',
  },
];

const GENERATOR_MODES: Array<{
  id: GeneratorModeId;
  kicker: string;
  title: string;
  description: string;
  templateId: SocialTemplateId;
  tone: SocialTone;
}> = [
  {
    id: 'trending_topics',
    kicker: 'Trending ideas',
    title: 'Trending topics for your stay',
    description: 'Timely angles built for attention and current travel demand.',
    templateId: 'special_offer',
    tone: 'urgent',
  },
  {
    id: 'evergreen_ideas',
    kicker: 'Evergreen ideas',
    title: 'Reliable posts that never go stale',
    description: 'Classic hooks for amenities, location, comfort, and guest fit.',
    templateId: 'featured_stay',
    tone: 'professional',
  },
  {
    id: 'viral_hooks',
    kicker: 'Viral hooks',
    title: 'Click-start intros and scroll-stoppers',
    description: 'Short, punchy openers for reels, stories, and carousel covers.',
    templateId: 'story_pack',
    tone: 'adventurous',
  },
  {
    id: 'surprise_me',
    kicker: 'Surprise me',
    title: 'Unexpected angles from listing facts',
    description: 'Fresh topic combinations when you do not want to overthink it.',
    templateId: 'lifestyle_escape',
    tone: 'friendly',
  },
];

const CONTENT_TOOLS = [
  { label: 'New Post Ideas', active: true },
  { label: 'Quick Templates', active: false },
  { label: 'Media Collections', active: false },
  { label: 'Content Calendar', active: false },
];

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
  const [selectedIdeaMode, setSelectedIdeaMode] = useState<IdeaModeId>('brand_new');
  const [selectedGeneratorMode, setSelectedGeneratorMode] = useState<GeneratorModeId>('evergreen_ideas');
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
  const selectedIdea = useMemo(() => IDEA_MODES.find((item) => item.id === selectedIdeaMode) ?? IDEA_MODES[0], [selectedIdeaMode]);
  const selectedGenerator = useMemo(() => GENERATOR_MODES.find((item) => item.id === selectedGeneratorMode) ?? GENERATOR_MODES[0], [selectedGeneratorMode]);

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
      setSelectedDraftId((currentDraftId) => currentDraftId ?? nextDrafts[0]?.id ?? null);
    }
    void loadWorkspace().catch((error) => console.error('Failed to load content workspace', error));
    return () => {
      cancelled = true;
    };
  }, [profile]);

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

  function applyIdeaMode(modeId: IdeaModeId) {
    const mode = IDEA_MODES.find((item) => item.id === modeId) ?? IDEA_MODES[0];
    setSelectedIdeaMode(mode.id);
    setSelectedTemplateId(mode.templateId);
    setTone(mode.tone);
  }

  function applyGeneratorMode(modeId: GeneratorModeId) {
    const mode = GENERATOR_MODES.find((item) => item.id === modeId) ?? GENERATOR_MODES[0];
    setSelectedGeneratorMode(mode.id);
    setSelectedTemplateId(mode.templateId);
    setTone(mode.tone);
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
    <div className="min-w-0 space-y-6 overflow-hidden">
      <div className="min-w-0 space-y-6">
          <header className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase text-primary">Content Studio</p>
                <Popover>
                  <PopoverTrigger className="inline-flex h-8 items-center rounded-full border border-outline-variant bg-surface px-3 text-xs font-semibold transition-colors hover:bg-surface-container-low">
                    Studio Tools <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 p-3">
                    <Button className="h-10 w-full justify-center rounded-lg font-semibold" onClick={handleGeneratePostSet} disabled={!selectedListing || !creativeSourceUrl || isGenerating || !contentEnabled}>
                      {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Create Post
                    </Button>

                    <div className="space-y-1">
                      <p className="px-2 text-xs font-bold uppercase text-on-surface-variant">Tools</p>
                      {CONTENT_TOOLS.map((item) => (
                        <button
                          key={item.label}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${item.active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}
                          type="button"
                        >
                          <span>{item.label}</span>
                          {!item.active ? <span className="text-[10px] uppercase text-on-surface-variant">Soon</span> : null}
                        </button>
                      ))}
                    </div>

                    <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                      <div className="flex items-center gap-2">
                        <WalletCards className="h-4 w-4 text-primary" />
                        <p className="text-xs font-bold uppercase text-on-surface-variant">Wallet</p>
                      </div>
                      <p className="mt-2 text-2xl font-bold">{entitlements?.creditBalance ?? '...'}</p>
                      <p className="text-xs text-on-surface-variant">Credits available</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {CREDIT_PACKS.map((credits) => (
                          <button
                            key={credits}
                            className="rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs font-semibold hover:border-primary hover:text-primary"
                            onClick={() => createContentCreditsCheckout(credits).then((checkout) => window.location.assign(checkout.redirectUrl)).catch((error) => toast.error(error instanceof Error ? error.message : 'Credit purchase failed.'))}
                            type="button"
                          >
                            +{credits}
                          </button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <h1 className="mt-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">Get inspired for {selectedListing?.title ?? 'your next stay'}</h1>
              <p className="mt-1 text-sm text-on-surface-variant">Choose the channel, idea source, and output type. The engine builds the draft and visual pack.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                {entitlements?.remainingIncludedDrafts ?? '...'} included left
              </span>
              <Button variant="outline" onClick={() => navigate('/pricing?audience=host')}>Manage Plan</Button>
            </div>
          </header>

          <div className="flex min-w-0 max-w-full gap-3 overflow-x-auto pb-1">
            {SOCIAL_PLATFORMS.map((item) => {
              const isSupported = selectedTemplate.supportedPlatforms.includes(item.id);
              return (
                <button
                  key={item.id}
                  disabled={!isSupported}
                  onClick={() => setPlatform(item.id)}
                  className={`flex min-w-fit items-center gap-2 rounded-full border bg-surface-container-lowest px-4 py-3 text-sm font-semibold shadow-sm transition ${platform === item.id ? 'border-primary text-primary ring-2 ring-primary/15' : 'border-outline-variant text-on-surface'} ${isSupported ? 'hover:border-primary' : 'cursor-not-allowed opacity-40'}`}
                  type="button"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-low text-xs font-bold">{item.label.slice(0, 2)}</span>
                  {item.label}
                </button>
              );
            })}
          </div>

          <Card className="min-w-0 overflow-hidden rounded-xl border-outline-variant bg-surface-container-lowest p-0">
            <div className="border-b border-outline-variant px-6 py-5">
              <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold">AI Content Generator</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">Pick a property, then choose how the engine should brainstorm.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg bg-surface-container-low px-3 py-2 text-sm font-semibold capitalize">{entitlements?.plan ?? '...'}</span>
                  <span className="rounded-lg bg-surface-container-low px-3 py-2 text-sm font-semibold">{entitlements?.usedDraftsThisMonth ?? '...'} used this month</span>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-0 lg:grid-cols-[0.92fr_1.08fr]">
              <section className="min-w-0 border-b border-outline-variant p-6 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-bold">Start with a sniff of an idea</h3>
                    <p className="text-sm text-on-surface-variant">{selectedIdea.description}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {IDEA_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => applyIdeaMode(mode.id)}
                      className={`flex w-full gap-3 rounded-lg border p-4 text-left transition ${selectedIdeaMode === mode.id ? 'border-primary bg-primary/5 ring-2 ring-primary/10' : 'border-outline-variant hover:border-primary/60'}`}
                      type="button"
                    >
                      <span className={`mt-1 h-3 w-3 rounded-full border ${selectedIdeaMode === mode.id ? 'border-primary bg-primary' : 'border-outline-variant'}`} />
                      <span>
                        <span className="block font-semibold">{mode.title}: {selectedListing?.type ?? 'Holiday Rental Property'}</span>
                        <span className="mt-1 block text-sm text-on-surface-variant">{mode.description}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-5 space-y-3">
                  <select
                    className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium"
                    value={selectedListing?.id ?? ''}
                    onChange={(event) => setSelectedListing(listings.find((listing) => listing.id === event.target.value) ?? null)}
                  >
                    {listings.map((listing) => (
                      <option key={listing.id} value={listing.id}>{listing.title}</option>
                    ))}
                  </select>

                  <Input
                    value={customHeadline}
                    onChange={(event) => setCustomHeadline(event.target.value)}
                    placeholder={selectedTemplate.supportsHeadlineOverride ? 'Optional campaign hook or headline' : 'This output type uses a system headline'}
                    disabled={!selectedTemplate.supportsHeadlineOverride}
                  />
                </div>
              </section>

              <section className="min-w-0 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-bold">Choose what to generate</h3>
                    <p className="text-sm text-on-surface-variant">{selectedGenerator.description}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {GENERATOR_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => applyGeneratorMode(mode.id)}
                      className={`grid w-full grid-cols-[auto_1fr] gap-4 rounded-lg border p-4 text-left transition ${selectedGeneratorMode === mode.id ? 'border-primary bg-primary/5 ring-2 ring-primary/10' : 'border-outline-variant hover:border-primary/60'}`}
                      type="button"
                    >
                      <span className={`mt-1 h-3 w-3 rounded-full border ${selectedGeneratorMode === mode.id ? 'border-primary bg-primary' : 'border-outline-variant'}`} />
                      <span>
                        <span className="block text-xs font-bold uppercase text-primary">{mode.kicker}</span>
                        <span className="mt-1 block font-semibold">{mode.title}</span>
                        <span className="mt-1 block text-sm text-on-surface-variant">{mode.description}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <label className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant p-4">
                    <span className="font-medium">Include price</span>
                    <input type="checkbox" checked={includePrice} onChange={(event) => setIncludePrice(event.target.checked)} className="h-5 w-5 accent-primary" />
                  </label>
                  <label className={`flex items-center justify-between gap-4 rounded-lg border border-outline-variant p-4 ${selectedTemplate.supportsSpecialOffer ? '' : 'opacity-50'}`}>
                    <span className="font-medium">Include special offer</span>
                    <input type="checkbox" checked={includeSpecialOffer} onChange={(event) => setIncludeSpecialOffer(event.target.checked)} disabled={!selectedTemplate.supportsSpecialOffer} className="h-5 w-5 accent-primary" />
                  </label>
                </div>

                {selectedListing?.images?.length ? (
                  <div className="mt-5 grid grid-cols-4 gap-3">
                    {selectedListing.images.slice(0, 4).map((imageUrl) => (
                      <button key={imageUrl} onClick={() => { setCreativeSourceUrl(imageUrl); setGeneratedCreative(null); }} className={`overflow-hidden rounded-lg border ${creativeSourceUrl === imageUrl ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`} type="button">
                        <img src={imageUrl} alt="" className="aspect-square w-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-on-surface-variant">Selected: {selectedTemplate.name} · {tone} · {getPlatformLabel(platform)}</p>
                  <Button className="h-12 rounded-lg px-6 font-bold" aria-label="Generate Post Set" disabled={!selectedListing || !creativeSourceUrl || isGenerating || !contentEnabled} onClick={handleGeneratePostSet}>
                    {isGenerating ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Building...</> : <><Sparkles className="mr-2 h-5 w-5" />Generate Post Set · 1 Credit</>}
                  </Button>
                </div>
              </section>
            </div>
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
