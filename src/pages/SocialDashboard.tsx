import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  Facebook,
  Image as ImageIcon,
  Instagram,
  Linkedin,
  Loader2,
  Send,
  Share2,
  Sparkles,
  Twitter,
} from 'lucide-react';
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

const CREDIT_PACKS = [10, 25, 50];

export default function SocialDashboard({ listings }: { listings: Listing[] }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const listingIdFromUrl = searchParams.get('listingId');

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [tone, setTone] = useState<'professional' | 'friendly' | 'adventurous' | 'luxurious' | 'urgent'>('professional');
  const [platform, setPlatform] = useState<'instagram' | 'facebook' | 'twitter' | 'linkedin' | null>(null);
  const [copied, setCopied] = useState(false);
  const [entitlements, setEntitlements] = useState<ContentEntitlements | null>(null);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [creativeSourceUrl, setCreativeSourceUrl] = useState<string | null>(null);
  const [creativeBrief, setCreativeBrief] = useState('');
  const [isGeneratingCreative, setIsGeneratingCreative] = useState(false);
  const [generatedCreative, setGeneratedCreative] = useState<GeneratedSocialCreative | null>(null);
  const billingStatus = searchParams.get('billing_status');
  const checkoutId = searchParams.get('checkout_id');

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) ?? null,
    [drafts, selectedDraftId],
  );

  useEffect(() => {
    if (listingIdFromUrl && listings.length > 0) {
      const listing = listings.find((item) => item.id === listingIdFromUrl);
      if (listing) {
        setSelectedListing(listing);
      }
    }
  }, [listingIdFromUrl, listings]);

  useEffect(() => {
    const nextSource = selectedListing?.images?.[0] ?? null;
    setCreativeSourceUrl(nextSource);
    setGeneratedCreative(null);
  }, [selectedListing]);

  useEffect(() => {
    let cancelled = false;

    async function loadContentWorkspace() {
      if (!profile || profile.role !== 'host') return;
      try {
        const [nextEntitlements, nextDrafts] = await Promise.all([
          getContentEntitlements(),
          listContentDrafts(),
        ]);

        if (cancelled) return;
        setEntitlements(nextEntitlements);
        setDrafts(nextDrafts);
        if (!selectedDraftId && nextDrafts.length > 0) {
          setSelectedDraftId(nextDrafts[0].id);
        }
      } catch (error) {
        console.error('Failed to load content workspace', error);
      }
    }

    loadContentWorkspace();
    return () => {
      cancelled = true;
    };
  }, [profile, selectedDraftId]);

  useEffect(() => {
    if (!profile || !checkoutId || !billingStatus) {
      return;
    }

    let cancelled = false;

    async function resolveCheckout() {
      try {
        const result = await getCheckoutStatus(checkoutId);
        if (cancelled) {
          return;
        }

        if (result.checkoutType !== 'content_credits') {
          return;
        }

        if (result.status === 'paid') {
          const nextEntitlements = await getContentEntitlements();
          if (cancelled) {
            return;
          }
          setEntitlements(nextEntitlements);
          toast.success('Credit top-up confirmed. Your content wallet has been updated.');
          return;
        }

        if (billingStatus === 'cancelled' || result.status === 'cancelled') {
          toast.message('Credit checkout cancelled. No credits were added.');
          return;
        }

        if (billingStatus === 'failed' || result.status === 'failed') {
          toast.error('Credit payment failed. Nothing was added.');
          return;
        }

        toast.message('Credit payment is still being confirmed. Give the webhook a moment and refresh if needed.');
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to resolve content credit checkout', error);
        }
      }
    }

    resolveCheckout();
    return () => {
      cancelled = true;
    };
  }, [billingStatus, checkoutId, profile]);

  useEffect(() => {
    if (!selectedDraft) {
      setEditorContent('');
      setScheduleAt('');
      return;
    }
    setEditorContent(selectedDraft.content);
    setScheduleAt(selectedDraft.scheduledFor ? selectedDraft.scheduledFor.slice(0, 16) : '');
  }, [selectedDraft]);

  const handleGeneratePost = async (selectedPlatform: 'instagram' | 'facebook' | 'twitter' | 'linkedin') => {
    if (!selectedListing) return;
    setPlatform(selectedPlatform);
    setIsGeneratingPost(true);
    try {
      const response = await generateContentDraft(selectedListing, selectedPlatform, tone);
      setDrafts((current) => [response.draft, ...current]);
      setEntitlements(response.entitlements);
      setSelectedDraftId(response.draft.id);
      setCopied(false);
      toast.success('Draft generated and saved to your content workspace.');
    } catch (error) {
      console.error('Error generating post:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate draft.');
    } finally {
      setIsGeneratingPost(false);
    }
  };

  const handleBuyCredits = async (credits: number) => {
    try {
      const checkout = await createContentCreditsCheckout(credits);
      window.location.assign(checkout.redirectUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Credit purchase failed.');
    }
  };

  const handleSaveDraft = async (status: ContentDraft['status']) => {
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
      toast.success(
        status === 'published'
          ? 'Draft marked as published.'
          : status === 'scheduled'
            ? 'Draft scheduled for distribution.'
            : 'Draft saved.',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const copyToClipboard = () => {
    if (!editorContent) return;
    navigator.clipboard.writeText(editorContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateCreative = async () => {
    if (!selectedListing || !creativeSourceUrl) return;

    setIsGeneratingCreative(true);
    try {
      const creative = await generateListingSocialCreative({
        listingId: selectedListing.id,
        sourceImageUrl: creativeSourceUrl,
        platform: platform ?? 'instagram',
        tone,
        brief: creativeBrief,
      });
      setGeneratedCreative(creative);
      toast.success('Social creative generated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate the social creative.');
    } finally {
      setIsGeneratingCreative(false);
    }
  };

  const handleDownloadCreative = () => {
    if (!generatedCreative) return;

    const link = document.createElement('a');
    const extension = generatedCreative.mimeType.includes('png') ? 'png' : 'jpg';
    link.href = generatedCreative.dataUrl;
    link.download = `ideal-stay-social-${selectedListing?.id || 'creative'}.${extension}`;
    link.click();
  };

  if (!profile || profile.role !== 'host') {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Content Studio</h1>
          <p className="text-on-surface-variant">This workspace is only available for hosts.</p>
        </header>
      </div>
    );
  }

  const contentEnabled = entitlements?.contentStudioEnabled ?? false;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Content Studio</h1>
        <p className="text-on-surface-variant">Generate, edit, save, and distribute listing content without leaving the host workspace.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">Entitlements</p>
              <h2 className="text-2xl font-bold">Plan-backed content access</h2>
            </div>
            <Button variant="outline" onClick={() => navigate('/pricing?audience=host')}>
              Manage Plan
            </Button>
          </div>

          {entitlements ? (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-outline-variant p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Plan</p>
                <p className="mt-2 text-2xl font-bold capitalize">{entitlements.plan}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Included left</p>
                <p className="mt-2 text-2xl font-bold">{entitlements.remainingIncludedDrafts}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Used this month</p>
                <p className="mt-2 text-2xl font-bold">{entitlements.usedDraftsThisMonth}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Credits</p>
                <p className="mt-2 text-2xl font-bold">{entitlements.creditBalance}</p>
              </div>
            </div>
          ) : (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {!contentEnabled && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              Your current host tier does not include content studio access. Move onto an eligible paid plan to unlock draft generation.
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-semibold">Quick credit top-ups</p>
            <div className="flex flex-wrap gap-3">
              {CREDIT_PACKS.map((credits) => (
                <Button key={credits} variant="outline" onClick={() => handleBuyCredits(credits)}>
                  Buy {credits} credits
                </Button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            <h2 className="text-2xl font-bold">Generate new draft</h2>
          </div>

          <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2">
            {listings.map((listing) => (
              <Card
                key={listing.id}
                className={`p-3 flex gap-3 items-center cursor-pointer transition-all ${selectedListing?.id === listing.id ? 'ring-2 ring-primary bg-surface-container-low' : 'hover:bg-surface-container-lowest'}`}
                onClick={() => setSelectedListing(listing)}
              >
                <img src={listing.images[0] || `https://picsum.photos/seed/${listing.id}/100/100`} className="w-16 h-16 rounded-lg object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm truncate">{listing.title}</h3>
                  <p className="text-xs text-on-surface-variant truncate">{listing.location}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-on-surface">Tone</p>
            <div className="flex flex-wrap gap-2">
              {(['professional', 'friendly', 'adventurous', 'luxurious', 'urgent'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setTone(item)}
                  className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${tone === item ? 'bg-gradient-to-r from-slate-900 to-blue-600 text-white shadow-md' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-on-surface">Platform</p>
            <div className="flex flex-wrap gap-3">
              {(['instagram', 'facebook', 'twitter', 'linkedin'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setPlatform(item)}
                  className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 text-sm font-medium ${platform === item ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary' : 'border-outline-variant hover:border-outline hover:bg-surface-container-lowest'}`}
                >
                  {item === 'instagram' && <Instagram className="w-4 h-4 text-pink-600" />}
                  {item === 'facebook' && <Facebook className="w-4 h-4 text-primary" />}
                  {item === 'twitter' && <Twitter className="w-4 h-4 text-sky-500" />}
                  {item === 'linkedin' && <Linkedin className="w-4 h-4 text-blue-700" />}
                  <span className="capitalize">{item}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            size="lg"
            className="w-full rounded-xl h-14 font-bold text-lg shadow-lg shadow-primary/20"
            disabled={!selectedListing || !platform || isGeneratingPost || !contentEnabled}
            onClick={() => platform && handleGeneratePost(platform)}
          >
            {isGeneratingPost ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Draft Post
              </>
            )}
          </Button>
        </Card>
      </div>

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          <h2 className="text-2xl font-bold">Social image studio</h2>
        </div>

        {!selectedListing ? (
          <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
            Pick a listing first. Then we can turn one of its photos into a polished social asset.
          </div>
        ) : selectedListing.images.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
            This listing has no images yet. Upload listing photos first, then generate social creatives from them.
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Source photo</p>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedListing.images.map((imageUrl) => (
                      <button
                        key={imageUrl}
                        type="button"
                        onClick={() => {
                          setCreativeSourceUrl(imageUrl);
                          setGeneratedCreative(null);
                        }}
                        className={`overflow-hidden rounded-2xl border transition-all ${creativeSourceUrl === imageUrl ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`}
                      >
                        <img src={imageUrl} alt="" className="aspect-square w-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Creative brief</p>
                  <Input
                    value={creativeBrief}
                    onChange={(event) => setCreativeBrief(event.target.value)}
                    placeholder="Optional: rooftop sunset, premium launch look, weekend promo angle..."
                  />
                  <p className="text-xs text-on-surface-variant">
                    Tone and platform above also steer the visual direction.
                  </p>
                </div>

                <Button
                  className="w-full"
                  disabled={!creativeSourceUrl || !contentEnabled || isGeneratingCreative}
                  onClick={handleGenerateCreative}
                >
                  {isGeneratingCreative ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Designing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Social Creative
                    </>
                  )}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-on-surface-variant">Original</p>
                  <div className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest">
                    {creativeSourceUrl && (
                      <img src={creativeSourceUrl} alt="" className="aspect-[4/5] w-full object-cover" referrerPolicy="no-referrer" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-on-surface-variant">Generated creative</p>
                    {generatedCreative && (
                      <Button variant="outline" size="sm" onClick={handleDownloadCreative}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest">
                    {generatedCreative ? (
                      <img src={generatedCreative.dataUrl} alt="Generated social creative" className="aspect-[4/5] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center px-6 text-center text-sm text-on-surface-variant">
                        Generate a social creative to preview the Gemini-designed version here.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            <h2 className="text-2xl font-bold">Draft library</h2>
          </div>

          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
            {drafts.map((draft) => (
              <button
                key={draft.id}
                onClick={() => setSelectedDraftId(draft.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-colors ${selectedDraftId === draft.id ? 'border-primary bg-primary/5' : 'border-outline-variant hover:bg-surface-container-lowest'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{draft.listingTitle}</p>
                    <p className="text-xs text-on-surface-variant capitalize">{draft.platform} • {draft.tone}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{draft.status}</span>
                </div>
                <p className="mt-3 text-sm text-on-surface-variant line-clamp-3">{draft.content}</p>
              </button>
            ))}

            {drafts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
                No drafts yet. Generate one and it will land here.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Draft editor</h2>
              <p className="text-sm text-on-surface-variant">Edit copy, schedule distribution, or mark content as published after you push it out.</p>
            </div>
            <button
              onClick={copyToClipboard}
              className="p-2 bg-surface border border-outline-variant rounded-lg shadow-sm hover:bg-surface-container-lowest transition-colors flex items-center gap-2 text-sm font-medium"
              disabled={!selectedDraft}
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-on-surface-variant" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {!selectedDraft ? (
            <div className="rounded-2xl border border-dashed border-outline-variant p-10 text-center text-on-surface-variant">
              Pick a draft from the left to edit it.
            </div>
          ) : (
            <>
              <textarea
                className="min-h-[280px] w-full rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
              />

              <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" />
                    Schedule distribution
                  </label>
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    disabled={!entitlements?.canSchedule}
                  />
                  {!entitlements?.canSchedule && (
                    <p className="text-xs text-on-surface-variant">Scheduling unlocks on Professional and Premium.</p>
                  )}
                </div>

                <Button
                  variant="outline"
                  disabled={isSavingDraft}
                  onClick={() => handleSaveDraft('draft')}
                >
                  {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Draft'}
                </Button>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    disabled={!scheduleAt || !entitlements?.canSchedule || isSavingDraft}
                    onClick={() => handleSaveDraft('scheduled')}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Schedule
                  </Button>
                  <Button
                    disabled={isSavingDraft}
                    onClick={() => handleSaveDraft('published')}
                  >
                    Publish Logged
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-on-surface-variant">Preview</h3>
                <div className="prose prose-sm max-w-none">
                  <Markdown>{editorContent}</Markdown>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
