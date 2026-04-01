import React, { useState, useEffect, useRef } from 'react';
import { Booking, Listing, Message } from '@/types';
import { X, Send, Info, Home, MapPin, CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { listMessages, sendMessage as sendPlatformMessage } from '@/lib/messaging-client';

interface ChatModalProps {
  booking: Booking;
  listing: Listing;
  currentUserUid: string;
  onClose: () => void;
}

export default function ChatModal({ booking, listing, currentUserUid, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isHost = currentUserUid === booking.hostUid;
  const otherPartyUid = isHost ? booking.guestUid : booking.hostUid;

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string, isSystem = false, suggestionType?: Message['suggestionType']) => {
    if (!text.trim() && !isSystem) return;
    
    setIsSending(true);
    try {
      const savedMessage = await sendPlatformMessage({
        bookingId: booking.id,
        receiverId: otherPartyUid,
        text,
        isSystem,
        suggestionType,
      });
      setMessages((current) => [...current, savedMessage]);

      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const suggestions = isHost ? [
    { label: 'Send House Rules', icon: Home, text: "Here are the house rules for your stay. Please let me know if you have any questions.", type: 'house_rules' },
    { label: 'Send Directions', icon: MapPin, text: "Here are the directions to the property. Looking forward to your arrival!", type: 'directions' },
    { label: 'Payment Info', icon: CreditCard, text: "Please find the payment details for your booking. Let me know once settled.", type: 'payment_info' },
  ] : [
    { label: 'Confirm Check-in', icon: CheckCircle2, text: "I have successfully checked in! Everything looks great.", type: 'checkin' },
    { label: 'Confirm Checkout', icon: CheckCircle2, text: "I have checked out. Thank you for the wonderful stay!", type: 'checkout' },
  ];

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
            const isMine = msg.senderId === currentUserUid;
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
                    "p-3 rounded-2xl text-sm shadow-sm",
                    isMine 
                      ? "bg-primary text-white rounded-tr-none" 
                      : "bg-surface-container-high text-on-surface rounded-tl-none"
                  )}
                >
                  {msg.text}
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
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => sendMessage(s.text, false, s.type as Message['suggestionType'])}
            className="flex items-center gap-2 whitespace-nowrap bg-surface-container-lowest border border-outline-variant px-3 py-1.5 rounded-full text-[11px] font-bold hover:bg-primary/5 hover:border-primary transition-all group"
          >
            <s.icon className="w-3 h-3 text-primary group-hover:scale-110 transition-transform" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface-container-low border-t border-outline-variant">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(newMessage);
          }}
          className="flex gap-2"
        >
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
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
