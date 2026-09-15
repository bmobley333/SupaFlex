// src/utils/networkTelemetry.ts
// Lightweight runtime telemetry and bandwidth guardrail for SupaFlex
// Tracks cumulative session egress from Supabase REST endpoints and flags oversized payloads.

interface SessionNetworkStats {
  totalBytes: number;
  requestCount: number;
  largePayloadWarnings: number;
  lastUpdated: string;
}

let sessionTotalBytes = 0;
let sessionRequestCount = 0;
let largePayloadWarnings = 0;
let isTelemetryInitialized = false;

const PAYLOAD_ALERT_THRESHOLD_BYTES = 100 * 1024; // 100 KB guardrail alert

export function initNetworkTelemetry(): void {
  if (isTelemetryInitialized || typeof window === 'undefined') return;
  isTelemetryInitialized = true;

  const originalFetch = window.fetch;
  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const response = await originalFetch(...args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : '';
      // Only track requests directed at Supabase backend
      if (url.includes('supabase.co')) {
        sessionRequestCount++;

        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const bytes = parseInt(contentLength, 10);
          if (!isNaN(bytes) && bytes > 0) {
            recordPayloadSize(url, bytes);
          }
        } else {
          // If no content-length header (chunked or compressed), inspect clone body size
          response.clone().text().then((text) => {
            recordPayloadSize(url, text.length);
          }).catch(() => {});
        }
      }
    } catch {
      // Telemetry should never crash application requests
    }

    return response;
  };
}

function recordPayloadSize(url: string, bytes: number): void {
  sessionTotalBytes += bytes;

  if (bytes >= PAYLOAD_ALERT_THRESHOLD_BYTES) {
    largePayloadWarnings++;
    console.warn(
      `[SupaFlex Guardrail] ⚠️ High Egress Payload Detected: ${(bytes / 1024).toFixed(1)} KB from ${url.split('?')[0]}`
    );
  }
}

export function getSessionNetworkStats(): SessionNetworkStats {
  return {
    totalBytes: sessionTotalBytes,
    requestCount: sessionRequestCount,
    largePayloadWarnings,
    lastUpdated: new Date().toISOString(),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getFormattedSessionEgress(): string {
  return formatBytes(sessionTotalBytes);
}
