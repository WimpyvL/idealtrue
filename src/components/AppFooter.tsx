import { Globe2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';

const documentationLinks = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms-of-service' },
  { label: 'Host Agreement', to: '/host-agreement' },
  { label: 'Guest Agreement', to: '/guest-agreement' },
  { label: 'Liability Waiver', to: '/liability-waiver' },
  { label: 'Cancellation Policy', to: '/cancellation-policy' },
];

export default function AppFooter() {
  return (
    <footer className="relative z-30 border-t border-outline-variant bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <Link to="/" aria-label="Go to Ideal Stay home" className="inline-flex">
              <BrandLogo variant="inline" size="sm" className="h-7" />
            </Link>
          </div>

          <nav aria-label="Documentation" className="flex max-w-3xl flex-wrap gap-x-4 gap-y-2 text-sm">
            <span className="w-full font-semibold text-on-surface md:w-auto">Documentation</span>
            {documentationLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-on-surface-variant transition-colors hover:text-on-surface"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-on-surface-variant md:text-sm">
            <span className="inline-flex items-center gap-2">
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              English (ZA)
            </span>
            <span>ZAR</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
