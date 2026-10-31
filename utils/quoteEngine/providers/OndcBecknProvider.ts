import { CityKey } from '../../cityDetector';
import {
  AsyncRideProvider,
  FareQuote,
  ProviderConnection,
  RideQuoteRequest,
} from '../types';

const DEFAULT_ONDC_BAP_URL =
  process.env.EXPO_PUBLIC_ONDC_BAP_URL || 'http://localhost:4040';

export class OndcBecknProvider implements AsyncRideProvider {
  id = 'ondc_beckn_live';
  name = 'ONDC Mobility Network';
  type = 'async' as const;

  private bapUrl: string;
  private callback?: (
    reqId: string,
    quotes: FareQuote[],
    error?: Error
  ) => void;

  constructor(bapUrl = DEFAULT_ONDC_BAP_URL) {
    this.bapUrl = bapUrl.replace(/\/$/, '');
  }

  async getConnectionStatus(): Promise<ProviderConnection> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${this.bapUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        return {
          providerId: this.id,
          status: 'connected',
          connectedAt: new Date().toISOString(),
        };
      }
    } catch {}
    return {
      providerId: this.id,
      status: 'disconnected',
    };
  }

  async isAvailable(city: CityKey): Promise<boolean> {
    // ONDC Mobility (Namma Yatri / Bharat Cab / Yatri Sathi) operates across major Indian cities
    return true;
  }

  onQuoteResult(
    callback: (reqId: string, quotes: FareQuote[], error?: Error) => void
  ): void {
    this.callback = callback;
  }

  async createQuoteRequest(request: RideQuoteRequest): Promise<string> {
    const reqId = `ondc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2200);
        const searchRes = await fetch(`${this.bapUrl}/ondc/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!searchRes.ok) {
          this.callback?.(reqId, []);
          return;
        }

        const { transactionId } = await searchRes.json();
        if (!transactionId) {
          this.callback?.(reqId, []);
          return;
        }

        // Poll for `/on_search` webhook completion (up to 3 attempts over ~1.5s)
        for (const waitMs of [420, 500, 600]) {
          await new Promise((r) => setTimeout(r, waitMs));
          const pollRes = await fetch(
            `${this.bapUrl}/ondc/quotes/${encodeURIComponent(transactionId)}`
          );
          if (!pollRes.ok) break;
          const pollData = await pollRes.json();
          if (
            pollData.status === 'completed' ||
            (Array.isArray(pollData.quotes) && pollData.quotes.length > 0)
          ) {
            this.callback?.(reqId, pollData.quotes || []);
            return;
          }
        }

        this.callback?.(reqId, []);
      } catch {
        // Gracefully resolve empty if ONDC BAP server is offline
        this.callback?.(reqId, []);
      }
    })();

    return reqId;
  }
}
