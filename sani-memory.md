## Change Log

- Added `public/ideal-stay-logo.png` from the supplied asset and created `src/components/BrandLogo.tsx` to centralize branding.
- Replaced old text/icon branding in `src/components/AppNavigation.tsx`, `src/components/HostLayout.tsx`, `src/pages/AdminDashboard.tsx`, and `src/pages/SignupPage.tsx`.
- Updated `src/App.tsx` loading state and `index.html` favicon links so the logo shows consistently across the site and browser chrome.
- Removed the redundant amber breakage-deposit callout from `src/components/ListingDetail.tsx` and kept the single summary-row version in the booking panel.
- Removed pre-enquiry breakage-deposit visibility from `src/components/ListingDetail.tsx` and `src/components/PropertyCard.tsx` so the deposit is not broadcast on public listing surfaces.
- Restored breakage-deposit visibility inside the date-selected booking summary in `src/components/ListingDetail.tsx`, showing it only after dates are chosen and including it in the displayed pre-enquiry total.
