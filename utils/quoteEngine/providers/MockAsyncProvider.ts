import { CityKey } from '../../cityDetector';
import { estimateFare } from '../../fareEngine';
import { AsyncRideProvider, FareQuote, ProviderConnection, RideQuoteRequest } from '../types';

export class MockAsyncProvider implements AsyncRideProvider {
  id = 'mock_async_namma_yatri';
  name = 'Namma Yatri';
  type = 'async' as const;
  
  private callback?: (reqId: string, quotes: FareQuote[], error?: Error) => void;

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      providerId: this.id,
      status: 'connected',
    };
  }

  async isAvailable(city: CityKey): Promise<boolean> {
    const est = estimateFare('Namma Yatri', city, 5, 15);
    return est.available;
  }

  onQuoteResult(callback: (reqId: string, quotes: FareQuote[], error?: Error) => void): void {
    this.callback = callback;
  }

  async createQuoteRequest(request: RideQuoteRequest): Promise<string> {
    const reqId = `mock-req-${Date.now()}`;
    
    // Simulate async network delay (e.g., ONDC on_select webhook arriving later)
    setTimeout(() => {
      if (this.callback) {
        const est = estimateFare('Namma Yatri', request.city, request.distanceKm, request.durationMin);
        if (!est.available) {
          this.callback(reqId, []);
          return;
        }
        const quotes: FareQuote[] = [
          {
            providerId: this.id,
            providerName: this.name,
            rideType: 'Auto',
            price: est.low,
            currency: 'INR',
            etaMinutes: 4,
            distanceKm: request.distanceKm,
            source: 'live_provider',
            confidence: 'live',
            fetchedAt: new Date().toISOString(),
            isAvailable: true,
            metadata: {
              highEstimate: est.high,
              isSurge: est.isSurge,
            },
          }
        ];
        this.callback(reqId, quotes);
      }
    }, 1200);
    
    return reqId;
  }
}
