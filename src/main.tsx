import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { initializeClientMonitoring } from './lib/monitoring';
import { createIdealStayQueryClient } from './lib/query-client';
import { getClientRuntimeConfig } from './lib/runtime-config';

const CANONICAL_HOST = "www.idealstay.co.za";
const queryClient = createIdealStayQueryClient();

initializeClientMonitoring(getClientRuntimeConfig());

if (typeof window !== "undefined") {
  const { hostname, protocol, pathname, search, hash } = window.location;
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local");
  const isCanonicalHost = hostname === CANONICAL_HOST;

  if (!isLocalhost && !isCanonicalHost) {
    window.location.replace(`${protocol}//${CANONICAL_HOST}${pathname}${search}${hash}`);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
