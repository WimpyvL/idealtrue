import type { Page, Route } from "@playwright/test";
import {
  workflowBilling,
  workflowBookings,
  workflowContentDrafts,
  workflowKyc,
  workflowListings,
  workflowMessages,
  workflowNotifications,
  workflowReferrals,
  workflowReviews,
  workflowUsers,
} from "../../fixtures/workflows.ts";

export type WorkflowRouteMock = {
  url: string | RegExp;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  status?: number;
  json: unknown;
};

export const defaultWorkflowRouteMocks: WorkflowRouteMock[] = [
  {
    url: /\/api\/encore\/identity\/(session|get-session)$/,
    method: "GET",
    json: { user: workflowUsers.guest },
  },
  {
    url: /\/api\/encore\/catalog\/listings(?:\?.*)?$/,
    method: "GET",
    json: { listings: [workflowListings.active, workflowListings.blocked] },
  },
  {
    url: /\/api\/encore\/catalog\/listings\/quota$/,
    method: "GET",
    json: { quota: { plan: "professional", used: 1, limit: 10, canCreateListing: true } },
  },
  {
    url: /\/api\/encore\/booking\/my-bookings(?:\?.*)?$/,
    method: "GET",
    json: {
      bookings: [
        workflowBookings.pending,
        workflowBookings.approvedAwaitingPayment,
        workflowBookings.proofSubmitted,
        workflowBookings.confirmed,
      ],
    },
  },
  {
    url: /\/api\/encore\/messaging\/messages(?:\?.*)?$/,
    method: "GET",
    json: { messages: [workflowMessages.guestMessage, workflowMessages.attachmentMessage] },
  },
  {
    url: /\/api\/encore\/messaging\/messages$/,
    method: "POST",
    json: { message: workflowMessages.guestMessage },
  },
  {
    url: /\/api\/encore\/ops\/kyc\/submissions\/me$/,
    method: "GET",
    json: { submission: workflowKyc.pending },
  },
  {
    url: /\/api\/encore\/ops\/kyc\/submissions(?:\?.*)?$/,
    method: "GET",
    json: { submissions: [workflowKyc.pending, workflowKyc.rejected] },
  },
  {
    url: /\/api\/encore\/ops\/notifications(?:\?.*)?$/,
    method: "GET",
    json: { notifications: Object.values(workflowNotifications) },
  },
  {
    url: /\/api\/encore\/reviews\/listing\/.+$/,
    method: "GET",
    json: { reviews: [workflowReviews.approved] },
  },
  {
    url: /\/api\/encore\/referrals\/my-rewards(?:\?.*)?$/,
    method: "GET",
    json: { rewards: [workflowReferrals.approved, workflowReferrals.rejected] },
  },
  {
    url: /\/api\/encore\/billing\/host-account$/,
    method: "GET",
    json: { account: workflowBilling.voucherActive },
  },
  {
    url: /\/api\/encore\/billing\/content-drafts(?:\?.*)?$/,
    method: "GET",
    json: { drafts: [workflowContentDrafts.draft, workflowContentDrafts.scheduled] },
  },
];

function matchesMethod(route: Route, method?: WorkflowRouteMock["method"]) {
  return !method || route.request().method().toUpperCase() === method;
}

export async function installWorkflowRouteMocks(page: Page, mocks: WorkflowRouteMock[] = defaultWorkflowRouteMocks) {
  for (const mock of mocks) {
    await page.route(mock.url, async (route) => {
      if (!matchesMethod(route, mock.method)) {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: mock.status ?? 200,
        contentType: "application/json",
        body: JSON.stringify(mock.json),
      });
    });
  }
}
