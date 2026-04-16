## Change Log

- Added `public/ideal-stay-logo.png` from the supplied asset and created `src/components/BrandLogo.tsx` to centralize branding.
- Replaced old text/icon branding in `src/components/AppNavigation.tsx`, `src/components/HostLayout.tsx`, `src/pages/AdminDashboard.tsx`, and `src/pages/SignupPage.tsx`.
- Updated `src/App.tsx` loading state and `index.html` favicon links so the logo shows consistently across the site and browser chrome.
- Removed the redundant amber breakage-deposit callout from `src/components/ListingDetail.tsx` and kept the single summary-row version in the booking panel.
- Removed pre-enquiry breakage-deposit visibility from `src/components/ListingDetail.tsx` and `src/components/PropertyCard.tsx` so the deposit is not broadcast on public listing surfaces.
- Restored breakage-deposit visibility inside the date-selected booking summary in `src/components/ListingDetail.tsx`, showing it only after dates are chosen and including it in the displayed pre-enquiry total.
- Added a durable listing-availability ledger in `encore/catalog` so manual host blocks, approved enquiry holds, and booked stays are tracked separately instead of being flattened into one fragile `blocked_dates` array.
- Tightened `encore/booking/api.ts` so booking creation and enquiry approval now fail closed on overlapping availability instead of relying on client-side honesty.
- Updated `src/types.ts`, `src/lib/domain-mappers.ts`, and `src/pages/HostAvailability.tsx` so the host calendar distinguishes manual blocks from approved-payment holds and confirmed stays.
