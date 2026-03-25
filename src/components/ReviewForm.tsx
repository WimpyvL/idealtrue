import React, { useState } from 'react';
import { Booking, OperationType } from '@/types';
import { db } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { handleFirestoreError } from '@/lib/firestore';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ReviewForm({ booking, onClose }: { booking: Booking, onClose: () => void }) {
  const [ratings, setRatings] = useState({
    cleanliness: 5,
    accuracy: 5,
    communication: 5,
    location: 5,
    value: 5
  });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        listingId: booking.listingId,
        guestUid: booking.guestUid,
        hostUid: booking.hostUid,
        ...ratings,
        comment,
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reviews');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">How was your stay?</h2>
        <p className="text-on-surface-variant">Your feedback helps the community and the host.</p>
      </div>

      <div className="space-y-6">
        {Object.entries(ratings).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="font-medium capitalize">{key}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatings(prev => ({ ...prev, [key]: star }))}
                  className="p-1 transition-transform active:scale-90"
                >
                  <Star className={cn("w-6 h-6", star <= val ? "fill-on-surface text-on-surface" : "text-outline-variant")} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold uppercase text-on-surface-variant">Written Review</label>
        <textarea
          required
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What did you love? What could be better?"
          className="w-full bg-surface-container-low border border-outline-variant rounded-2xl p-4 min-h-[120px] focus:ring-2 focus:ring-primary outline-none transition-all"
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Post Review'}
        </Button>
      </div>
    </form>
  );
}
