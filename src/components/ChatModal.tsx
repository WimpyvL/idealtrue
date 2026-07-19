import React, { useState, useEffect, useRef } from 'react';
import type { Booking, HostQuickReplySettings, Listing, Message } from '@/types';
import { X, Send, Info, Home, MapPin, CreditCard, CheckCircle2, Loader2, HelpCircle, Clock3, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getMyHostQuickReplies, listMessages, sendMessage as sendPlatformMessage, uploadMessageAttachment } from '@/lib/messaging-client';
import {
  canGuestPay,
  getGuestInquiryDeadlineText,
  getHostInquiryDeadlineText,
  getMessagingProcessContext,
  isAwaitingGuestPayment,
} from '@/lib/inquiry-state';

interface ChatModalProps {
  booking: Booking;
  listing: Listing;
  currentUserId: string;
  hostQuickReplies?: HostQuickReplySettings;
  onClose: () => void;
  onSubmitPaymentProof?: (booking: Booking) => void;
}

export default function ChatModal({
  booking,
  listing,
  currentUserId,
  hostQuickReplies,
  onClose,
  onSubmitPaymentProof,
}: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [loadedHostQuickReplies, setLoadedHostQuickReplies] = useState<HostQuickReplySettings | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHost = currentUserId === booking.hostId;
  const otherPartyId = isHost ? booking.guestId : booking.hostId;
  const effectiveHostQuickReplies = hostQuickReplies ?? loadedHostQuickReplies ?? undefined;
  const messagingContext = getMessagingProcessContext(booking, isHost ? 'host' : 'guest', effectiveHostQuickReplies);
  const deadlineText = isHost ? getHostInquiryDeadlineText(booking) : getGuestInquiryDeadlineText(booking);
  const showGuestPaymentProofAction = !isHost && canGuestPay(booking) && !!onSubmitPaymentProof;
  const showHostPaymentPromptAction = isHost && isAwaitingGuestPayment(booking);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    listMessages(booking.id)
      .then((nextMessages) => {
        if (!cancelled) {
          setMessages(nextMessages);
        }
      })
      .catch((error) => {
        console.error('Failed to load messages:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [booking.id]);

  useEffect(() => {
    if (!isHost || hostQuickReplies) {
      return;
    }

    let cancelled = false;
    getMyHostQuickReplies()
      .then((settings) => {
        if (!cancelled) {
          setLoadedHostQuickReplies(settings);
        }
      })
      .catch((error) => {
        console.error('Failed to load host quick replies:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [hostQuickReplies, isHost]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (
    text: string,
    isSystem = false,
    suggestionType?: Message['suggestionType'],
    attachmentUrl?: string | null,
  ) => {
    if (!text.trim() && !attachmentUrl && !isSystem) return;

    setIsSending(true);
    try {
      const savedMessage = await sendPlatformMessage({
        bookingId: booking.id,
        receiverId: otherPartyId,
        text,
        isSystem,
        suggestionType,
        attachmentUrl,
      });
      setMessages((current) => [...current, savedMessage]);

      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmitMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;

    let attachmentKey: string | null = null;
    setIsSending(true);
    try {
      if (selectedFile) {
        attachmentKey = await uploadMessageAttachment({ bookingId: booking.id, file: selectedFile });
      }
    } catch (error) {
      console.error('Failed to upload message attachment:', error);
      setIsSending(false);
      return;
    }
    setIsSending(false);

    await sendMessage(newMessage, false, undefined, attachmentKey);
  };

  const getSuggestionIcon = (suggestionType: Message['suggestionType']) => {
    switch (suggestionType) {
      case 'house_rules':
        return Home;
      case 'directions':
        return MapPin;
      case 'payment_info':
        return CreditCard;
      case 'checkin':
      case 'checkout':
        return CheckCircle2;
      default:
        return HelpCircle;
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-outline-variant">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
            {isHost ? 'G' : 'H'}
          </div>
          <div>
            <h3 className="font-bold text-sm">Chat with {isHost ? 'Guest' : 'Host'}</h3>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">{listing.title}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className={cn(
          'border-b border-outline-variant px-4 py-3 text-sm',
          messagingContext.tone === 'warning' && 'bg-amber-50 text-amber-950',
          messagingContext.tone === 'success' && 'bg-emerald-50 text-emerald-950',
          messagingContext.tone === 'closed' && 'bg-slate-100 text-slate-700',
          messagingContext.tone === 'neutral' && 'bg-primary/5 text-on-surface',
        )}
      >
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider">{messagingContext.stageLabel}</p>
            <p className="font-medium leading-snug">{messagingContext.nextStepLabel}</p>
            <p className="text-xs leading-relaxed opacity-80">{deadlineText ?? messagingContext.stageDescription}</p>
            {showGuestPaymentProofAction ? (
              <Button
                type="button"
                size="sm"
                className="mt-2 rounded-full bg-amber-900 text-white hover:bg-amber-800"
                onClick={() => onSubmitPaymentProof?.(booking)}
              >
                Submit proof of payment
              </Button>
            ) : showHostPaymentPromptAction ? (
              <Button
                type="button"
                size="sm"
                className="mt-2 rounded-full bg-amber-900 text-white hover:bg-amber-800"
                disabled={isSending}
                onClick={() => {
                  const paymentPrompt = messagingContext.quickActions.find(
                    (action) => action.priority === 'primary',
                  );
                  if (!paymentPrompt) {
                    return;
                  }
                  void sendMessage(paymentPrompt.text, false, paymentPrompt.suggestionType);
                }}
              >
                Send payment details
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-lowest scroll-smooth"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
            <Info className="w-8 h-8 text-outline-variant" />
            <p className="text-sm text-on-surface-variant">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="bg-surface-container-high text-[10px] px-3 py-1 rounded-full text-on-surface-variant font-bold uppercase tracking-tight">
                    {msg.text}
                  </span>
                </div>
              );
            }
            return (
              <div 
                key={msg.id} 
                className={cn(
                  "flex flex-col max-w-[80%]",
                  isMine ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div 
                  className={cn(
                    "space-y-2 p-3 rounded-2xl text-sm shadow-sm",
                    isMine 
                      ? "bg-primary text-white rounded-tr-none" 
                      : "bg-surface-container-high text-on-surface rounded-tl-none"
                  )}
                >
                  {msg.text ? <p>{msg.text}</p> : null}
                  {msg.attachmentUrl ? (
                    <a
                      href={msg.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold underline-offset-2 hover:underline',
                        isMine ? 'border-white/40 text-white' : 'border-outline-variant text-primary',
                      )}
                    >
                      <Paperclip className="h-3 w-3" />
                      Attachment
                    </a>
                  ) : null}
                </div>
                <span className="text-[10px] text-outline-variant mt-1 px-1">
                  {format(new Date(msg.createdAt), 'HH:mm')}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Suggestions */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar border-t border-outline-variant bg-surface-container-low">
        {messagingContext.quickActions.map((s) => {
          const Icon = getSuggestionIcon(s.suggestionType);
          return (
          <button
            key={s.label}
            onClick={() => sendMessage(s.text, false, s.suggestionType)}
            disabled={isSending}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap border px-3 py-1.5 rounded-full text-[11px] font-bold transition-all group disabled:cursor-not-allowed disabled:opacity-60',
              s.priority === 'primary'
                ? 'bg-primary text-on-primary border-primary hover:bg-primary/90'
                : 'bg-surface-container-lowest border-outline-variant hover:bg-primary/5 hover:border-primary',
            )}
          >
            <Icon className={cn('w-3 h-3 transition-transform group-hover:scale-110', s.priority === 'primary' ? 'text-on-primary' : 'text-primary')} />
            {s.label}
          </button>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface-container-low border-t border-outline-variant">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmitMessage();
          }}
          className="space-y-2"
        >
          {selectedFile ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface-variant">
              <span className="min-w-0 truncate font-medium">{selectedFile.name}</span>
              <button
                type="button"
                className="shrink-0 rounded-full p-1 hover:bg-surface-container-high"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="rounded-full shrink-0"
              disabled={isSending}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="rounded-2xl bg-surface-container-lowest border-outline-variant focus-visible:ring-primary"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="rounded-full shrink-0"
              disabled={(!newMessage.trim() && !selectedFile) || isSending}
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
