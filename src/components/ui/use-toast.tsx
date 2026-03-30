import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive";

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

function showToast({ title, description, variant = "default" }: ToastOptions) {
  if (variant === "destructive") {
    sonnerToast.error(title, { description });
    return;
  }

  sonnerToast(title, { description });
}

export const useToast = () => ({
  toast: showToast,
});
