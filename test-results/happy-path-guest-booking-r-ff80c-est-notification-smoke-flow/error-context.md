# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: happy-path.spec.ts >> guest booking request, host approval, and guest notification smoke flow
- Location: tests\e2e\happy-path.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Booking request sent! The host will contact you shortly.')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Booking request sent! The host will contact you shortly.')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - region "Notifications alt+T"
  - navigation [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e7] [cursor=pointer]:
        - img [ref=e9]
        - generic [ref=e12]: Ideal Stay
      - generic [ref=e13]:
        - link "Explore" [ref=e14] [cursor=pointer]:
          - /url: /
        - link "My Stays" [ref=e15] [cursor=pointer]:
          - /url: /guest
        - link "Rewards" [ref=e16] [cursor=pointer]:
          - /url: /referral
        - link "Account" [ref=e17] [cursor=pointer]:
          - /url: /account
      - generic [ref=e19]:
        - button "Open notifications" [ref=e21]:
          - img [ref=e22]
        - generic [ref=e25]:
          - paragraph [ref=e26]: Guest Example
          - paragraph [ref=e27]: guest
        - button "Open account" [ref=e28] [cursor=pointer]: G
        - button [ref=e29]:
          - img
  - main [ref=e30]:
    - generic [ref=e31]:
      - generic [ref=e32]:
        - generic [ref=e33]:
          - button "Grid" [ref=e34]
          - button "Map" [ref=e35]
        - generic [ref=e42]:
          - generic [ref=e44]:
            - button [ref=e45]:
              - img [ref=e46]
            - textbox "Describe the trip you want to plan..." [ref=e49]
            - button [ref=e50]:
              - img [ref=e51]
          - generic [ref=e55]:
            - button [ref=e56]:
              - img [ref=e57]
            - generic [ref=e60] [cursor=pointer]:
              - generic [ref=e61]: Where
              - textbox "Search destinations" [ref=e62]
            - generic [ref=e63] [cursor=pointer]:
              - generic [ref=e64]: Check in
              - generic [ref=e65]: Add dates
            - generic [ref=e66] [cursor=pointer]:
              - generic [ref=e67]: Check out
              - generic [ref=e68]: Add dates
            - generic [ref=e69] [cursor=pointer]:
              - generic [ref=e70]: Who
              - generic [ref=e71]:
                - button [ref=e72]:
                  - img [ref=e73]
                - generic [ref=e74]: "1"
                - button [ref=e75]:
                  - img [ref=e76]
            - button [ref=e78]:
              - img [ref=e79]
      - generic [ref=e84]:
        - button "Filters" [ref=e86]:
          - img [ref=e87]
          - generic [ref=e88]: Filters
        - button "All" [ref=e89] [cursor=pointer]:
          - img [ref=e91]
          - generic [ref=e94]: All
        - button "Hotels & Resorts" [ref=e95] [cursor=pointer]:
          - img [ref=e96]
          - generic [ref=e100]: Hotels & Resorts
        - button "Guesthouse & BnB" [ref=e101] [cursor=pointer]:
          - img [ref=e102]
          - generic [ref=e105]: Guesthouse & BnB
        - button "Safari & Bush" [ref=e106] [cursor=pointer]:
          - img [ref=e107]
          - generic [ref=e110]: Safari & Bush
        - button "Winelands" [ref=e111] [cursor=pointer]:
          - img [ref=e112]
          - generic [ref=e114]: Winelands
        - button "Coastal & Beach" [ref=e115] [cursor=pointer]:
          - img [ref=e116]
          - generic [ref=e121]: Coastal & Beach
        - button "Nature & Country" [ref=e122] [cursor=pointer]:
          - img [ref=e123]
          - generic [ref=e125]: Nature & Country
        - button "Budget & Backpackers" [ref=e126] [cursor=pointer]:
          - img [ref=e127]
          - generic [ref=e131]: Budget & Backpackers
        - button "Unique Stays" [ref=e132] [cursor=pointer]:
          - img [ref=e133]
          - generic [ref=e136]: Unique Stays
      - generic [ref=e137]:
        - heading "Featured Stays" [level=2] [ref=e141]
        - generic [ref=e144]:
          - generic [ref=e149] [cursor=pointer]:
            - generic [ref=e150]:
              - img "Sea Point Stay" [ref=e151]
              - button [ref=e153]:
                - img [ref=e154]
              - generic [ref=e157]: Save 10%
            - generic [ref=e159]:
              - heading "Sea Point Stay" [level=3] [ref=e160]
              - paragraph [ref=e161]: Cape Town
              - generic [ref=e163]:
                - generic [ref=e164]: R1,800
                - generic [ref=e165]: night
          - generic [ref=e166]:
            - button "Prev" [ref=e167]
            - button "Next" [ref=e168]
      - generic [ref=e169]:
        - generic [ref=e170]:
          - heading "Recently Added" [level=2] [ref=e171]
          - paragraph [ref=e172]: Check out the newest properties on Ideal Stay.
        - generic [ref=e174] [cursor=pointer]:
          - generic [ref=e175]:
            - img "Sea Point Stay" [ref=e176]
            - button [ref=e178]:
              - img [ref=e179]
            - generic [ref=e182]: Save 10%
          - generic [ref=e184]:
            - heading "Sea Point Stay" [level=3] [ref=e185]
            - paragraph [ref=e186]: Cape Town
            - generic [ref=e188]:
              - generic [ref=e189]: R1,800
              - generic [ref=e190]: night
      - generic [ref=e191]:
        - heading "Find your next Ideal Stay" [level=1] [ref=e192]
        - paragraph [ref=e193]: Discover unique accommodations around the world.
      - generic [ref=e195] [cursor=pointer]:
        - generic [ref=e196]:
          - img "Sea Point Stay" [ref=e197]
          - button [ref=e199]:
            - img [ref=e200]
          - generic [ref=e203]: Save 10%
        - generic [ref=e205]:
          - heading "Sea Point Stay" [level=3] [ref=e206]
          - paragraph [ref=e207]: Cape Town
          - generic [ref=e209]:
            - generic [ref=e210]: R1,800
            - generic [ref=e211]: night
  - generic [ref=e214]:
    - generic [ref=e215]:
      - heading "Sea Point Stay" [level=2] [ref=e216]
      - button [ref=e217]:
        - img [ref=e218]
    - generic [ref=e221]:
      - button [ref=e224]
      - generic [ref=e225]:
        - generic [ref=e226]:
          - generic [ref=e227]:
            - generic [ref=e228]:
              - generic [ref=e229]:
                - heading "apartment in Cape Town" [level=3] [ref=e230]
                - paragraph [ref=e231]: 3 guests · 1 bedrooms · 1 beds · 1 bath
              - generic [ref=e232]:
                - img [ref=e233]
                - generic [ref=e235]: New
                - generic [ref=e236]: ·
                - generic [ref=e237]: 0 reviews
            - separator [ref=e238]
            - paragraph [ref=e239]: Ocean-facing apartment
            - generic [ref=e240]:
              - heading "Amenities" [level=4] [ref=e241]
              - generic [ref=e243]: wifi
          - generic [ref=e244]:
            - heading "Reviews" [level=3] [ref=e246]
            - paragraph [ref=e247]: No reviews yet for this listing.
        - generic [ref=e249]:
          - generic [ref=e250]:
            - generic [ref=e251]: R1,800 / night
            - generic [ref=e252]:
              - img [ref=e253]
              - generic [ref=e255]: New
          - generic [ref=e256]:
            - button "Check-in Add date Checkout Add date" [ref=e257]:
              - generic [ref=e258]:
                - paragraph [ref=e259]: Check-in
                - paragraph [ref=e260]: Add date
              - generic [ref=e261]:
                - paragraph [ref=e262]: Checkout
                - paragraph [ref=e263]: Add date
            - button "Guests 1 guest" [ref=e264]:
              - paragraph [ref=e265]: Guests
              - paragraph [ref=e266]: 1 guest
          - button "Request to Book" [active] [ref=e267]
          - paragraph [ref=e268]: Payment is handled directly by the host
```

# Test source

```ts
  115 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: [listing] }) });
  116 |       return;
  117 |     }
  118 | 
  119 |     if (path.startsWith('/listings?hostId=') && method === 'GET') {
  120 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ listings: [listing] }) });
  121 |       return;
  122 |     }
  123 | 
  124 |     if (path === '/bookings/me' && method === 'GET') {
  125 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ bookings: currentSession ? [booking] : [] }) });
  126 |       return;
  127 |     }
  128 | 
  129 |     if (path === '/referrals/rewards' && method === 'GET') {
  130 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rewards: [] }) });
  131 |       return;
  132 |     }
  133 | 
  134 |     if (path === '/bookings' && method === 'POST') {
  135 |       const body = JSON.parse(request.postData() || '{}');
  136 |       booking = {
  137 |         ...booking,
  138 |         ...body,
  139 |         id: 'booking-1',
  140 |         guestId: currentSession?.id || guestUser.id,
  141 |         inquiryState: 'PENDING',
  142 |         paymentState: 'UNPAID',
  143 |         createdAt: '2026-04-01T10:05:00.000Z',
  144 |         updatedAt: '2026-04-01T10:05:00.000Z',
  145 |       };
  146 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ booking }) });
  147 |       return;
  148 |     }
  149 | 
  150 |     if (path === '/bookings/booking-1/status' && method === 'PATCH') {
  151 |       const body = JSON.parse(request.postData() || '{}');
  152 |       booking = {
  153 |         ...booking,
  154 |         inquiryState: body.status,
  155 |         paymentState: body.status === 'APPROVED' ? 'INITIATED' : booking.paymentState,
  156 |         updatedAt: '2026-04-01T10:10:00.000Z',
  157 |       };
  158 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ booking }) });
  159 |       return;
  160 |     }
  161 | 
  162 |     if (path === '/reviews/listing-1' && method === 'GET') {
  163 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reviews: [] }) });
  164 |       return;
  165 |     }
  166 | 
  167 |     if (path === '/ops/my-notifications' && method === 'GET') {
  168 |       const notifications =
  169 |         currentSession?.id === guestUser.id && booking.inquiryState === 'APPROVED' && booking.paymentState === 'INITIATED'
  170 |           ? [
  171 |               {
  172 |                 id: 'notification-1',
  173 |                 title: 'Payment requested',
  174 |                 message: 'Your booking was approved. Submit payment to confirm it.',
  175 |                 type: 'info',
  176 |                 target: guestUser.id,
  177 |                 actionPath: '/guest',
  178 |                 createdAt: '2026-04-01T10:10:00.000Z',
  179 |                 readAt: null,
  180 |               },
  181 |             ]
  182 |           : [];
  183 | 
  184 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications }) });
  185 |       return;
  186 |     }
  187 | 
  188 |     if (path === '/ops/my-notifications/read' && method === 'POST') {
  189 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ readAt: '2026-04-01T10:12:00.000Z' }) });
  190 |       return;
  191 |     }
  192 | 
  193 |     if (path === '/ops/my-notifications/read-all' && method === 'POST') {
  194 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ readAt: '2026-04-01T10:12:00.000Z' }) });
  195 |       return;
  196 |     }
  197 | 
  198 |     await route.fulfill({
  199 |       status: 500,
  200 |       contentType: 'application/json',
  201 |       body: JSON.stringify({ error: `Unhandled smoke route: ${method} ${path}` }),
  202 |     });
  203 |   });
  204 | 
  205 |   await page.goto('/signup');
  206 |   await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  207 |   await expect(page.getByRole('heading', { name: 'Sign in to Ideal Stay' })).toBeVisible();
  208 |   await page.getByPlaceholder('you@example.com').fill(guestUser.email);
  209 |   await page.locator('input[type="password"]').first().fill('password123');
  210 |   await page.getByRole('button', { name: 'Sign in' }).last().click();
  211 | 
  212 |   await expect(page.getByText('My Stays')).toBeVisible();
  213 |   await page.getByText('Sea Point Stay').first().click();
  214 |   await page.getByRole('button', { name: 'Request to Book' }).click();
> 215 |   await expect(page.getByText('Booking request sent! The host will contact you shortly.')).toBeVisible();
      |                                                                                            ^ Error: expect(locator).toBeVisible() failed
  216 | 
  217 |   await page.goto('/signup');
  218 |   await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  219 |   await expect(page.getByRole('heading', { name: 'Sign in to Ideal Stay' })).toBeVisible();
  220 |   await page.getByPlaceholder('you@example.com').fill(hostUser.email);
  221 |   await page.locator('input[type="password"]').first().fill('password123');
  222 |   await page.getByRole('button', { name: 'Sign in' }).last().click();
  223 | 
  224 |   await page.getByRole('link', { name: 'Enquiries' }).click();
  225 |   await expect(page.getByRole('heading', { name: 'Sea Point Stay' }).first()).toBeVisible();
  226 |   await page.getByRole('button', { name: 'Approve' }).click();
  227 | 
  228 |   await page.goto('/signup');
  229 |   await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
  230 |   await expect(page.getByRole('heading', { name: 'Sign in to Ideal Stay' })).toBeVisible();
  231 |   await page.getByPlaceholder('you@example.com').fill(guestUser.email);
  232 |   await page.locator('input[type="password"]').first().fill('password123');
  233 |   await page.getByRole('button', { name: 'Sign in' }).last().click();
  234 | 
  235 |   await page.getByRole('link', { name: 'My Stays' }).click();
  236 |   await expect(page.getByText('Ready for Payment')).toBeVisible();
  237 |   await page.getByRole('button', { name: 'Open notifications' }).click();
  238 |   await expect(page.getByText('Payment requested')).toBeVisible();
  239 |   await expect(page.getByText('1 new')).toBeVisible();
  240 | });
  241 | 
```