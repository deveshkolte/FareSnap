import { CityKey } from '../../cityDetector';
import { AsyncRideProvider, FareQuote, ProviderConnection, RideQuoteRequest } from '../types';

export class MockAsyncProvider implements AsyncRideProvider {
  id = 'mock_async_namma_yatri';
  name = 'Namma Yatri'; // Pretend to be Namma Yatri for testing UI
  type = 'async' as const;
  
  private callback?: (reqId: string, quotes: FareQuote[], error?: Error) => void;

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      providerId: this.id,
      status: 'connected', // Assume connected for mock
    };
  }

  async isAvailable(city: CityKey): Promise<boolean> {
    return true; // Available everywhere for mock
  }

  onQuoteResult(callback: (reqId: string, quotes: FareQuote[], error?: Error) => void): void {
    this.callback = callback;
  }

  async createQuoteRequest(request: RideQuoteRequest): Promise<string> {
    const reqId = `mock-req-${Date.now()}`;
    
    // Simulate async network delay (e.g., ONDC on_select webhook arriving later)
    setTimeout(() => {
      if (this.callback) {
        const quotes: FareQuote[] = [
          {
            providerId: this.id,
            providerName: this.name,
            rideType: 'Auto',
            price: 142,
            currency: 'INR',
            etaMinutes: 4,
            distanceKm: request.distanceKm,
            source: 'live_provider',
            confidence: 'live',
            fetchedAt: new Date().toISOString(),
            isAvailable: true,
          }
        ];
        this.callback(reqId, quotes);
      }
    }, 2000);
    
    return reqId;
  }
}
