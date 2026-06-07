# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-payment-review.spec.ts >> guest request -> host approve -> guest proof -> host confirm -> guest review
- Location: tests\e2e\booking-payment-review.spec.ts:91:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'My Stays' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - region "Notifications alt+T"
  - navigation [ref=e4]:
    - generic [ref=e6]:
      - generic "Go to Ideal Stay home" [ref=e7] [cursor=pointer]:
        - img "Ideal Stay" [ref=e8]
      - generic [ref=e9]:
        - link "Explore" [ref=e10] [cursor=pointer]:
          - /url: /
        - link "Pricing" [ref=e11] [cursor=pointer]:
          - /url: /pricing
        - link "My Stays" [ref=e12] [cursor=pointer]:
          - /url: /guest
        - link "Rewards" [ref=e13] [cursor=pointer]:
          - /url: /referral
        - link "Account" [ref=e14] [cursor=pointer]:
          - /url: /account
      - generic [ref=e16]:
        - button "Open notifications" [ref=e18]:
          - img [ref=e19]
        - generic [ref=e22]:
          - paragraph [ref=e23]: Guest Example
          - paragraph [ref=e24]: guest
        - button "Open account" [ref=e25] [cursor=pointer]: G
        - button [ref=e26]:
          - img
  - main [ref=e27]:
    - generic [ref=e29]:
      - generic [ref=e30]:
        - img "Ideal Stay" [ref=e31]
        - heading "Sign in to Ideal Stay" [level=1] [ref=e32]
        - paragraph [ref=e33]: Use your email and password to get back into the platform.
      - generic [ref=e34]:
        - button "Create account" [ref=e35]
        - button "Sign in" [ref=e36]
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]:
            - text: Email address
            - textbox "you@example.com" [ref=e40]: guest@example.com
          - generic [ref=e41]:
            - text: Password
            - textbox "Enter your password" [ref=e42]: password123
        - generic [ref=e43]:
          - button "Sign in" [ref=e44]:
            - text: Sign in
            - img
          - generic [ref=e48]: or
          - button "Email me a password reset link" [ref=e50]:
            - img [ref=e51]
            - text: Email me a password reset link
          - paragraph [ref=e54]:
            - text: Need an account?
            - button "Open the signup form." [ref=e55]
  - contentinfo [ref=e56]:
    - generic [ref=e58]:
      - link "Go to Ideal Stay home" [ref=e60] [cursor=pointer]:
        - /url: /
        - img "Ideal Stay" [ref=e61]
      - navigation "Documentation" [ref=e62]:
        - link "Privacy" [ref=e63] [cursor=pointer]:
          - /url: /privacy
        - link "Terms" [ref=e64] [cursor=pointer]:
          - /url: /terms-of-service
        - link "Host Agreement" [ref=e65] [cursor=pointer]:
          - /url: /host-agreement
        - link "Guest Agreement" [ref=e66] [cursor=pointer]:
          - /url: /guest-agreement
        - link "Liability Waiver" [ref=e67] [cursor=pointer]:
          - /url: /liability-waiver
        - link "Cancellation Policy" [ref=e68] [cursor=pointer]:
          - /url: /cancellation-policy
      - generic [ref=e69]:
        - generic [ref=e70]:
          - img [ref=e71]
          - text: English (ZA)
        - generic [ref=e76]: ZAR
```

# Test source

```ts
  255 |     if (path === '/reviews' && method === 'POST') {
  256 |       reviewPosted = true;
  257 |       reviewRequestBody = body;
  258 |       await route.fulfill({
  259 |         status: 200,
  260 |         contentType: 'application/json',
  261 |         body: JSON.stringify({
  262 |           review: {
  263 |             id: 'review-1',
  264 |             listingId: listing.id,
  265 |             bookingId: booking.id,
  266 |             guestId: guestUser.id,
  267 |             hostId: hostUser.id,
  268 |             cleanliness: body.cleanliness,
  269 |             accuracy: body.accuracy,
  270 |             communication: body.communication,
  271 |             location: body.location,
  272 |             value: body.value,
  273 |             comment: body.comment,
  274 |             status: 'pending',
  275 |             createdAt: '2026-04-24T10:40:00.000Z',
  276 |           },
  277 |         }),
  278 |       });
  279 |       return;
  280 |     }
  281 | 
  282 |     if (path === '/referrals/rewards' && method === 'GET') {
  283 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rewards: [] }) });
  284 |       return;
  285 |     }
  286 | 
  287 |     if (path === '/ops/my-notifications' && method === 'GET') {
  288 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [] }) });
  289 |       return;
  290 |     }
  291 | 
  292 |     if (path === '/ops/my-notifications/read' && method === 'POST') {
  293 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ readAt: '2026-04-24T10:12:00.000Z' }) });
  294 |       return;
  295 |     }
  296 | 
  297 |     if (path === '/ops/my-notifications/read-all' && method === 'POST') {
  298 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ readAt: '2026-04-24T10:12:00.000Z' }) });
  299 |       return;
  300 |     }
  301 | 
  302 |     await route.fulfill({
  303 |       status: 500,
  304 |       contentType: 'application/json',
  305 |       body: JSON.stringify({ error: `Unhandled booking lifecycle route: ${method} ${path}` }),
  306 |     });
  307 |   });
  308 | 
  309 |   await signIn(page, guestUser.email);
  310 |   await page.getByText(listing.title).first().click();
  311 |   await page.getByRole('button', { name: /Check-in Add date Checkout Add date/ }).click();
  312 |   await page.locator(`button[data-day="${calendarDataDay(checkInDate)}"]`).first().click();
  313 |   await expect(page.getByText('Now choose your check-out date.')).toBeVisible();
  314 |   await page.locator(`button[data-day="${calendarDataDay(checkOutDate)}"]`).first().click({ force: true });
  315 |   await page.getByRole('button', { name: 'Request to Book' }).click();
  316 |   await expect(page.getByText('Booking request sent! The host will contact you shortly.')).toBeVisible();
  317 | 
  318 |   await signIn(page, hostUser.email);
  319 |   await page.getByRole('link', { name: 'Enquiries' }).click();
  320 |   await expect(page.getByRole('heading', { name: listing.title }).first()).toBeVisible();
  321 |   await page.getByRole('button', { name: 'Approve' }).click();
  322 |   await expect(page.getByText('Inquiry approved. Payment is now unlocked for the guest.')).toBeVisible();
  323 |   await expect(page.getByText('Awaiting Guest Payment').first()).toBeVisible();
  324 | 
  325 |   await signIn(page, guestUser.email);
  326 |   await page.getByRole('link', { name: 'My Stays' }).click();
  327 |   await expect(page.getByText('Ready for Payment')).toBeVisible();
  328 |   await expect(page.getByText('Payment unlocked. Submit payment proof before the approval window closes.')).toBeVisible();
  329 |   await page.getByRole('button', { name: 'Send Proof of Payment' }).click();
  330 |   await expect(page.getByRole('heading', { name: 'Submit Payment Proof' })).toBeVisible();
  331 |   await page.getByLabel('Payment reference').fill('HOST-booking-1');
  332 |   await page.locator('input[type="file"]').setInputFiles({
  333 |     name: 'payment-proof.png',
  334 |     mimeType: 'image/png',
  335 |     buffer: Buffer.from(
  336 |       'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atpU8sAAAAASUVORK5CYII=',
  337 |       'base64',
  338 |     ),
  339 |   });
  340 |   await expect(page.getByText('payment-proof.png')).toBeVisible();
  341 |   await page.getByRole('button', { name: 'Submit proof' }).click();
  342 |   await expect(page.getByText('Payment proof submitted. The host can now confirm receipt.')).toBeVisible();
  343 |   await expect(page.getByText('Payment proof submitted. Host confirmation is still pending.')).toBeVisible();
  344 | 
  345 |   await signIn(page, hostUser.email);
  346 |   await page.getByRole('link', { name: 'Enquiries' }).click();
  347 |   await expect(page.getByRole('heading', { name: 'Awaiting Payment Confirmation' })).toBeVisible();
  348 |   await expect(page.getByText('Payment reference:')).toBeVisible();
  349 |   await expect(page.getByRole('link', { name: 'Open private proof' })).toBeVisible();
  350 |   await page.getByRole('button', { name: 'Confirm Payment' }).click();
  351 |   await expect(page.getByText('Payment confirmed. The stay is now booked.')).toBeVisible();
  352 |   await expect(page.getByText('Confirmed Stays')).toBeVisible();
  353 | 
  354 |   await signIn(page, guestUser.email);
> 355 |   await page.getByRole('link', { name: 'My Stays' }).click();
      |                                                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  356 |   await expect(page.getByText('BOOKED', { exact: true })).toBeVisible();
  357 |   await expect(page.getByText('Payment confirmed. Your stay is booked.')).toBeVisible();
  358 |   await page.getByRole('button', { name: 'Review' }).click();
  359 |   await expect(page.getByRole('heading', { name: 'How was your stay?' })).toBeVisible();
  360 |   await page.getByPlaceholder('What did you love? What could be better?').fill('Great stay and clear host communication.');
  361 |   await page.getByRole('button', { name: 'Post Review' }).click();
  362 |   await expect(page.getByRole('heading', { name: 'How was your stay?' })).toHaveCount(0);
  363 | 
  364 |   expect(reviewPosted).toBe(true);
  365 |   expect(reviewRequestBody).toMatchObject({
  366 |     listingId: listing.id,
  367 |     bookingId: booking.id,
  368 |     hostId: hostUser.id,
  369 |     comment: 'Great stay and clear host communication.',
  370 |   });
  371 | });
  372 | 
```