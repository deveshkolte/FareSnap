import { CityKey } from '../cityDetector';
import { FareSnapEstimateProvider } from './providers/FareSnapEstimateProvider';
import { NammaYatriStubProvider, OlaStubProvider, RapidoStubProvider, UberStubProvider } from './providers/StubProviders';
import { FareQuote, RideProvider, RideQuoteRequest } from './types';

export type QuoteEngineListener = (quotes: FareQuote[], isComplete: boolean) => void;

export class QuoteEngine {
  private providers: RideProvider[] = [];
  private listeners: Set<QuoteEngineListener> = new Set();
  
  private currentQuotes: Map<string, FareQuote[]> = new Map();
  private pendingAsyncProviders = 0;
  
  private activeSessionId = 0;
  private activeRequestIds: Map<string, number> = new Map();
  
  constructor() {
    this.providers = [
      new UberStubProvider(),
      new OlaStubProvider(),
      new RapidoStubProvider(),
      new NammaYatriStubProvider(),
      new FareSnapEstimateProvider(),
    ];
    
    // Register callbacks for async providers
    for (const provider of this.providers) {
      if (provider.type === 'async') {
        provider.onQuoteResult((reqId, quotes, error) => {
          this.handleAsyncResult(provider.id, reqId, quotes, error);
        });
      }
    }
  }
  
  private handleAsyncResult(providerId: string, reqId: string, quotes: FareQuote[], error?: Error) {
    const sessionId = this.activeRequestIds.get(reqId);
    this.activeRequestIds.delete(reqId);
    if (sessionId !== this.activeSessionId) {
      return; // Ignore stale or unrelated request
    }
    
    if (error) {
      console.error(`Async error from provider ${providerId}:`, error);
    }
    
    this.currentQuotes.set(providerId, quotes || []);
    this.pendingAsyncProviders = Math.max(0, this.pendingAsyncProviders - 1);
    this.notifyListeners();
  }
  
  // For testing only
  replaceNammaYatriWithMock(mockProvider: RideProvider) {
    this.providers = this.providers.filter(
      (p) => p.id !== 'namma_yatri_live' && p.id !== mockProvider.id
    );
    this.providers.push(mockProvider);
    if (mockProvider.type === 'async') {
      mockProvider.onQuoteResult((reqId, quotes, error) => {
        this.handleAsyncResult(mockProvider.id, reqId, quotes, error);
      });
    }
  }

  subscribe(listener: QuoteEngineListener): () => void {
    this.listeners.add(listener);
    // immediately notify with current state
    listener(this.getSortedQuotes(), this.pendingAsyncProviders === 0);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const isComplete = this.pendingAsyncProviders === 0;
    const sorted = this.getSortedQuotes();
    for (const listener of this.listeners) {
      listener(sorted, isComplete);
    }
  }
  
  private getSortedQuotes(): FareQuote[] {
    const allQuotes = Array.from(this.currentQuotes.values()).flat();

    // Deduplicate by providerName: prefer live_provider over faresnap_estimate
    const byProviderName = new Map<string, FareQuote>();
    for (const quote of allQuotes) {
      const existing = byProviderName.get(quote.providerName);
      if (!existing) {
        byProviderName.set(quote.providerName, quote);
      } else if (quote.source === 'live_provider' && existing.source !== 'live_provider') {
        byProviderName.set(quote.providerName, quote);
      }
    }

    return Array.from(byProviderName.values()).sort((a, b) => {
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return a.price - b.price;
    });
  }

  async startQuoteRequest(request: RideQuoteRequest): Promise<void> {
    const sessionId = ++this.activeSessionId;
    this.currentQuotes.clear();
    this.activeRequestIds.clear();
    this.pendingAsyncProviders = this.providers.filter((p) => p.type === 'async').length;
    this.notifyListeners(); // Clear UI

    const promises = this.providers.map(async (provider) => {
      try {
        const isAvailable = await provider.isAvailable(request.city);
        if (sessionId !== this.activeSessionId) return;

        if (!isAvailable) {
          this.currentQuotes.set(provider.id, []);
          if (provider.type === 'async') {
            this.pendingAsyncProviders = Math.max(0, this.pendingAsyncProviders - 1);
          }
          return;
        }

        if (provider.type === 'sync') {
          const quotes = await provider.getQuote(request);
          if (sessionId === this.activeSessionId) {
            this.currentQuotes.set(provider.id, quotes);
          }
        } else if (provider.type === 'async') {
          const reqId = await provider.createQuoteRequest(request);
          if (sessionId !== this.activeSessionId) return;

          // If provider resolved synchronously inside createQuoteRequest, don't re-register
          if (!this.currentQuotes.has(provider.id)) {
            this.activeRequestIds.set(reqId, sessionId);

            // Safety timeout for async providers
            setTimeout(() => {
              if (sessionId !== this.activeSessionId) return;
              if (this.currentQuotes.has(provider.id)) return;

              this.activeRequestIds.delete(reqId);
              this.currentQuotes.set(provider.id, []);
              this.pendingAsyncProviders = Math.max(0, this.pendingAsyncProviders - 1);
              this.notifyListeners();
            }, 10000);
          }
        }
      } catch (error) {
        if (sessionId !== this.activeSessionId) return;
        
        console.error(`Error with provider ${provider.name}:`, error);
        this.currentQuotes.set(provider.id, []);
        if (provider.type === 'async') {
          this.pendingAsyncProviders = Math.max(0, this.pendingAsyncProviders - 1);
        }
      }
    });

    // Wait for all sync providers to finish and async providers to *start*
    await Promise.all(promises);
    if (sessionId === this.activeSessionId) {
      this.notifyListeners();
    }
  }
}
