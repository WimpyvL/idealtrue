import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Send, Loader2, ArrowLeft, Sparkles, Map, Calendar, Plane, Hotel } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

export default function HolidayPlanner() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery && messages.length === 0) {
      handleSend(initialQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || loading) return;

    const userMessage = text;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Build conversation history
      const history = messages.map(m => m.content).join('\n\n');
      const prompt = `You are an expert holiday planner AI. Help the user plan their trip. 
      Be concise, helpful, and format your response beautifully using markdown (headings, lists, bold text).
      
      Previous context:
      ${history}
      
      User query: ${userMessage}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      
      setMessages(prev => [...prev, { role: 'ai', content: response.text || "Sorry, I couldn't generate a response." }]);
    } catch (error: any) {
      console.error(error);
      
      let errorMessage = "Sorry, an error occurred while planning your trip. Please try again.";
      
      if (error?.message?.includes('API key not valid') || error?.status === 400) {
        errorMessage = "It looks like your Gemini API key is missing or invalid. Please configure a valid API key in the Secrets panel in the AI Studio UI.";
      }
      
      setMessages(prev => [...prev, { role: 'ai', content: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedPrompts = [
    { icon: Map, text: "Plan a 5-day itinerary for Cape Town" },
    { icon: Calendar, text: "Best time to visit the Kruger National Park?" },
    { icon: Plane, text: "Weekend getaway ideas near Johannesburg" },
    { icon: Hotel, text: "Luxury stays in the Garden Route" }
  ];

  return (
    <div className="flex flex-col h-screen bg-surface-container-lowest">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full hover:bg-surface-container-low">
            <ArrowLeft className="w-5 h-5 text-on-surface" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-on-surface leading-tight">AI Trip Planner</h1>
              <p className="text-xs text-on-surface-variant">Powered by Gemini</p>
            </div>
          </div>
        </div>
      </header>
      
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-8 pb-24">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/20">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-on-surface">Where to next?</h2>
                <p className="text-on-surface-variant max-w-md mx-auto">
                  I can help you build itineraries, find the best places to stay, and discover local secrets.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mt-8">
                {suggestedPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt.text)}
                    className="flex items-center gap-3 p-4 rounded-2xl border border-outline-variant/50 bg-surface hover:bg-surface-container-low hover:border-outline-variant transition-all text-left group"
                  >
                    <div className="p-2 rounded-xl bg-surface-container-high group-hover:bg-primary/10 transition-colors">
                      <prompt.icon className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-sm font-medium text-on-surface">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={cn(
                "flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                m.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "w-8 h-8 shrink-0 rounded-full flex items-center justify-center mt-1",
                  m.role === 'user' 
                    ? "bg-slate-200" 
                    : "bg-gradient-to-br from-blue-500 to-purple-600"
                )}>
                  {m.role === 'user' ? (
                    <div className="w-full h-full rounded-full bg-slate-300" /> // Placeholder for user avatar
                  ) : (
                    <Sparkles className="w-4 h-4 text-white" />
                  )}
                </div>
                
                <div className={cn(
                  "max-w-[85%] md:max-w-[75%] rounded-3xl px-6 py-4",
                  m.role === 'user' 
                    ? "bg-primary text-white rounded-tr-sm" 
                    : "bg-surface border border-outline-variant/30 rounded-tl-sm shadow-sm"
                )}>
                  {m.role === 'user' ? (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div className="prose prose-sm md:prose-base prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-a:text-primary prose-strong:text-slate-900">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {loading && (
            <div className="flex gap-4 animate-in fade-in duration-300">
              <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mt-1">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-surface border border-outline-variant/30 rounded-3xl rounded-tl-sm px-6 py-5 shadow-sm flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/30">
        <div className="max-w-3xl mx-auto relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Sparkles className="w-5 h-5 text-on-surface-variant" />
          </div>
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            className="w-full pl-12 pr-14 py-4 rounded-full border border-outline-variant bg-surface text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-[15px]"
            placeholder="Ask me anything about your trip..."
            disabled={loading}
          />
          <div className="absolute inset-y-0 right-2 flex items-center">
            <Button 
              onClick={() => handleSend(input)} 
              disabled={loading || !input.trim()}
              size="icon"
              className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
            </Button>
          </div>
        </div>
        <div className="text-center mt-3">
          <p className="text-[11px] text-on-surface-variant">
            AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </div>
    </div>
  );
}
