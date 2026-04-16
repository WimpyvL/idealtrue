import { cn } from '@/lib/utils';

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

const sizeClasses: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'h-10 w-auto',
  md: 'h-14 w-auto',
  lg: 'h-20 w-auto',
  xl: 'h-28 w-auto',
};

export default function BrandLogo({
  className,
  priority = false,
  size = 'md',
}: BrandLogoProps) {
  return (
    <img
      src="/ideal-stay-logo.png"
      alt="Ideal Stay"
      className={cn('block object-contain select-none', sizeClasses[size], className)}
      draggable={false}
      fetchPriority={priority ? 'high' : 'auto'}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
