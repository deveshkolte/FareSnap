import { CityKey } from '../../cityDetector';
import { SyncRideProvider, ProviderConnection, RideQuoteRequest, FareQuote } from '../types';

export class UberStubProvider implements SyncRideProvider {
  id = 'uber_live';
  name = 'Uber';
  type = 'sync' as const;

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      providerId: this.id,
      status: 'not_configured',
    };
  }

  async isAvailable(city: CityKey): Promise<boolean> {
    return true; 
  }

  async getQuote(request: RideQuoteRequest): Promise<FareQuote[]> {
    return []; // We return empty here, the fallback (FareSnapEstimateProvider) will provide the estimated quote.
  }
}

export class OlaStubProvider implements SyncRideProvider {
  id = 'ola_live';
  name = 'Ola';
  type = 'sync' as const;

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      providerId: this.id,
      status: 'not_configured',
    };
  }

  async isAvailable(city: CityKey): Promise<boolean> {
    return true;
  }

  async getQuote(request: RideQuoteRequest): Promise<FareQuote[]> {
    return [];
  }
}

export class RapidoStubProvider implements SyncRideProvider {
  id = 'rapido_live';
  name = 'Rapido';
  type = 'sync' as const;

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      providerId: this.id,
      status: 'not_configured',
    };
  }

  async isAvailable(city: CityKey): Promise<boolean> {
    return true;
  }

  async getQuote(request: RideQuoteRequest): Promise<FareQuote[]> {
    return [];
  }
}

export class NammaYatriStubProvider implements SyncRideProvider {
  id = 'namma_yatri_live';
  name = 'Namma Yatri';
  type = 'sync' as const;

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      providerId: this.id,
      status: 'not_configured',
    };
  }

  async isAvailable(city: CityKey): Promise<boolean> {
    return true;
  }

  async getQuote(request: RideQuoteRequest): Promise<FareQuote[]> {
    return [];
  }
}
