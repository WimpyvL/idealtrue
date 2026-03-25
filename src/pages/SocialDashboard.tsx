import React, { useState, useEffect } from 'react';
import { Listing } from '../types';
import { useSearchParams } from 'react-router-dom';
import { 
  Share2, 
  Sparkles, 
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Copy,
  CheckCircle2,
  Loader2,
  CalendarDays,
  Image as ImageIcon,
  ChevronRight,
  Send
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { generateSocialMediaPost } from '../services/gemini';
import Markdown from 'react-markdown';

export default function SocialDashboard({ listings }: { listings: Listing[] }) {
  const [searchParams] = useSearchParams();
  const listingIdFromUrl = searchParams.get('listingId');
  
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<string | null>(null);
  const [tone, setTone] = useState('professional');
  const [platform, setPlatform] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (listingIdFromUrl && listings.length > 0) {
      const listing = listings.find(l => l.id === listingIdFromUrl);
      if (listing) {
        setSelectedListing(listing);
      }
    }
  }, [listingIdFromUrl, listings]);

  const handleGeneratePost = async (selectedPlatform: string) => {
    if (!selectedListing) return;
    setPlatform(selectedPlatform);
    setIsGeneratingPost(true);
    setGeneratedPost(null);
    try {
      const post = await generateSocialMediaPost(selectedListing, selectedPlatform, tone);
      setGeneratedPost(post);
      setCopied(false);
    } catch (error) {
      console.error('Error generating post:', error);
      toast.error('Failed to generate post. Please try again.');
    } finally {
      setIsGeneratingPost(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedPost) {
      navigator.clipboard.writeText(generatedPost);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Social Media Generator</h1>
        <p className="text-on-surface-variant">Create AI-powered social media content to boost your bookings.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Step 1: Select Listing */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ImageIcon className="w-5 h-5" /> 1. Select Listing
          </h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {listings.map(listing => (
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
            {listings.length === 0 && <p className="text-sm text-outline-variant">No listings available.</p>}
          </div>
        </div>

        {/* Step 2 & 3: Generate Content */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" /> 2. Generate Content
          </h2>
          
          <Card className="p-6 min-h-[400px] flex flex-col">
            {!selectedListing ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 text-outline-variant">
                <Share2 className="w-12 h-12 opacity-50" />
                <p>Select a listing from the left to start generating content.</p>
              </div>
            ) : (
              <div className="space-y-8 flex-1">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-on-surface">Select Tone:</p>
                  <div className="flex flex-wrap gap-2">
                    {['professional', 'friendly', 'adventurous', 'luxurious', 'urgent'].map(t => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                          tone === t 
                            ? 'bg-gradient-to-r from-slate-900 to-blue-600 text-white shadow-md' 
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-on-surface">Select Platform:</p>
                  <div className="flex flex-wrap gap-3">
                    {['instagram', 'facebook', 'twitter', 'linkedin'].map(p => (
                      <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 text-sm font-medium ${
                          platform === p 
                            ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary' 
                            : 'border-outline-variant hover:border-outline hover:bg-surface-container-lowest'
                        }`}
                      >
                        {p === 'instagram' && <Instagram className="w-4 h-4 text-pink-600" />}
                        {p === 'facebook' && <Facebook className="w-4 h-4 text-primary" />}
                        {p === 'twitter' && <Twitter className="w-4 h-4 text-sky-500" />}
                        {p === 'linkedin' && <Linkedin className="w-4 h-4 text-blue-700" />}
                        <span className="capitalize">{p}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    size="lg" 
                    className="w-full rounded-xl h-14 font-bold text-lg shadow-lg shadow-primary/20"
                    disabled={!platform || isGeneratingPost}
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
                        Generate AI Post
                      </>
                    )}
                  </Button>
                </div>

                {isGeneratingPost && (
                  <div className="flex-1 flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-4 text-on-surface-variant">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-sm font-medium animate-pulse">AI is crafting your perfect post...</p>
                    </div>
                  </div>
                )}

                {generatedPost && !isGeneratingPost && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant relative group shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-sm text-on-surface-variant uppercase tracking-wider">Generated Post</h3>
                      <button 
                        onClick={copyToClipboard}
                        className="p-2 bg-surface border border-outline-variant rounded-lg shadow-sm hover:bg-surface-container-lowest transition-colors flex items-center gap-2 text-sm font-medium"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-on-surface-variant" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <Markdown>{generatedPost}</Markdown>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
