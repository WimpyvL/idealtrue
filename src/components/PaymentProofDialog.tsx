import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Booking, Listing } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PaymentProofDialogProps {
  booking: Booking | null;
  listing?: Listing | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (params: { id: string; paymentReference: string; paymentProofUrl: string | null }) => Promise<void>;
}

export default function PaymentProofDialog({
  booking,
  listing,
  open,
  onClose,
  onSubmit,
}: PaymentProofDialogProps) {
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!booking) {
      setPaymentReference("");
      setPaymentProofUrl("");
      setIsSubmitting(false);
      return;
    }

    setPaymentReference(booking.paymentReference ?? "");
    setPaymentProofUrl(booking.paymentProofUrl ?? "");
  }, [booking]);

  async function handleSubmit() {
    if (!booking) return;

    const trimmedReference = paymentReference.trim();
    if (!trimmedReference) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        id: booking.id,
        paymentReference: trimmedReference,
        paymentProofUrl: paymentProofUrl.trim() || null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Submit Payment Proof</DialogTitle>
          <DialogDescription>
            {listing
              ? `Upload the payment reference for ${listing.title}.`
              : "Submit the payment reference the host can match against their account."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {booking?.paymentInstructions && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                Host Payment Instructions
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface">
                {booking.paymentInstructions}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="payment-reference">Payment reference</Label>
            <Input
              id="payment-reference"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="Example: IDEAL-BOOKING-4821"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-proof-url">Proof URL</Label>
            <Textarea
              id="payment-proof-url"
              value={paymentProofUrl}
              onChange={(event) => setPaymentProofUrl(event.target.value)}
              placeholder="Optional: paste a receipt or bank-proof URL"
              className="min-h-[96px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !paymentReference.trim()}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit proof"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
