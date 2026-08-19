import { CityKey } from '../../cityDetector';
import { estimateFare } from '../../fareEngine';
import { SyncRideProvider, ProviderConnection, RideQuoteRequest, FareQuote } from '../types';

export class FareSnapEstimateProvider implements SyncRideProvider {
  id = 'faresnap_estimator';
  name = 'FareSnap Engine';
  type = 'sync' as const;

  private supportedApps = [
    { providerName: 'Uber', rideType: 'Cab', appNameForEngine: 'Uber' },
    { providerName: 'Ola', rideType: 'Cab', appNameForEngine: 'Ola' },
    { providerName: 'Rapido', rideType: 'Bike/Auto', appNameForEngine: 'Rapido' },
    { providerName: 'Namma Yatri', rideType: 'Auto', appNameForEngine: 'Namma Yatri' },
    { providerName: 'inDrive', rideType: 'Cab', appNameForEngine: 'inDrive' },
    { providerName: 'BluSmart', rideType: 'Electric', appNameForEngine: 'BluSmart' },
    { providerName: 'Meru Cabs', rideType: 'Cab', appNameForEngine: 'Meru Cabs' },
    { providerName: 'Bharat Cab', rideType: 'Cab', appNameForEngine: 'Bharat Cab' },
    { providerName: 'Savaari', rideType: 'Cab', appNameForEngine: 'Savaari' },
  ];

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      providerId: this.id,
      status: 'connected',
    };
  }

  async isAvailable(city: CityKey): Promise<boolean> {
    return true; // Always available as a fallback
  }

  async getQuote(request: RideQuoteRequest): Promise<FareQuote[]> {
    const quotes: FareQuote[] = [];

    for (const app of this.supportedApps) {
      const estimate = estimateFare(app.appNameForEngine, request.city, request.distanceKm, request.durationMin);
      
      if (estimate.available) {
        quotes.push({
          providerId: app.providerName.toLowerCase().replace(/\s+/g, '_'),
          providerName: app.providerName,
          rideType: app.rideType,
          price: estimate.low, // Returning the low estimate as price
          currency: 'INR',
          etaMinutes: null,
          distanceKm: request.distanceKm,
          source: 'faresnap_estimate',
          confidence: 'estimated',
          fetchedAt: new Date().toISOString(),
          isAvailable: true,
          metadata: {
            highEstimate: estimate.high,
            isSurge: estimate.isSurge,
          },
        });
      }
    }

    return quotes;
  }
}
