# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: kyc-admin-review.spec.ts >> host KYC submission can be reviewed and approved by an admin
- Location: tests\e2e\kyc-admin-review.spec.ts:256:1

# Error details

```
Test timeout of 30000ms exceeded.
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
        - link "Host Dashboard" [ref=e12] [cursor=pointer]:
          - /url: /host
        - link "My Stays" [ref=e13] [cursor=pointer]:
          - /url: /guest
        - link "Rewards" [ref=e14] [cursor=pointer]:
          - /url: /referral
        - link "Account" [ref=e15] [cursor=pointer]:
          - /url: /account
      - generic [ref=e17]:
        - button "Open notifications" [ref=e19]:
          - img [ref=e20]
        - generic [ref=e23]:
          - paragraph [ref=e24]: KYC Pending Host
          - paragraph [ref=e25]: host
        - button "Open account" [ref=e26] [cursor=pointer]: K
        - button [ref=e27]:
          - img
  - main [ref=e28]:
    - generic [ref=e30]:
      - generic [ref=e31]:
        - img "Ideal Stay" [ref=e32]
        - heading "Sign in to Ideal Stay" [level=1] [ref=e33]
        - paragraph [ref=e34]: Use your email and password to get back into the platform.
      - generic [ref=e35]:
        - button "Create account" [ref=e36]
        - button "Sign in" [ref=e37]
      - generic [ref=e38]:
        - generic [ref=e39]:
          - generic [ref=e40]:
            - text: Email address
            - textbox "you@example.com" [ref=e41]: pending-host@example.com
          - generic [ref=e42]:
            - text: Password
            - textbox "Enter your password" [ref=e43]: password123
        - generic [ref=e44]:
          - button "Sign in" [ref=e45]:
            - text: Sign in
            - img
          - generic [ref=e49]: or
          - button "Email me a password reset link" [ref=e51]:
            - img [ref=e52]
            - text: Email me a password reset link
          - paragraph [ref=e55]:
            - text: Need an account?
            - button "Open the signup form." [ref=e56]
  - contentinfo [ref=e57]:
    - generic [ref=e59]:
      - link "Go to Ideal Stay home" [ref=e61] [cursor=pointer]:
        - /url: /
        - img "Ideal Stay" [ref=e62]
      - navigation "Documentation" [ref=e63]:
        - link "Privacy" [ref=e64] [cursor=pointer]:
          - /url: /privacy
        - link "Terms" [ref=e65] [cursor=pointer]:
          - /url: /terms-of-service
        - link "Host Agreement" [ref=e66] [cursor=pointer]:
          - /url: /host-agreement
        - link "Guest Agreement" [ref=e67] [cursor=pointer]:
          - /url: /guest-agreement
        - link "Liability Waiver" [ref=e68] [cursor=pointer]:
          - /url: /liability-waiver
        - link "Cancellation Policy" [ref=e69] [cursor=pointer]:
          - /url: /cancellation-policy
      - generic [ref=e70]:
        - generic [ref=e71]:
          - img [ref=e72]
          - text: English (ZA)
        - generic [ref=e77]: ZAR
```