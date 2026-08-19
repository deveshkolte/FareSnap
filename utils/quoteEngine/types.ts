import { CityKey } from '../cityDetector';

export type FareQuoteSource = 'live_provider' | 'provider_estimate' | 'faresnap_estimate';
export type FareQuoteConfidence = 'live' | 'estimated';

export interface FareQuote {
  providerId: string;
  providerName: string;
  rideType: string;
  price: number | null;
  currency: string;
  etaMinutes: number | null;
  distanceKm: number | null;
  source: FareQuoteSource;
  confidence: FareQuoteConfidence;
  fetchedAt: string;
  isAvailable: boolean;
  bookingUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface RideQuoteRequest {
  pickup: { lat?: number; lng?: number; address: string };
  destination: { lat?: number; lng?: number; address: string };
  city: CityKey;
  distanceKm: number;
  durationMin: number;
}

export type ProviderConnectionStatus = 'connected' | 'disconnected' | 'requires_action' | 'not_configured' | 'error';

export interface ProviderConnection {
  providerId: string;
  status: ProviderConnectionStatus;
  connectedAt?: string;
}

export interface BaseRideProvider {
  id: string;
  name: string;
  type: 'sync' | 'async';
  getConnectionStatus(): Promise<ProviderConnection>;
  isAvailable(city: CityKey): Promise<boolean>;
  getBookingUrl?(quote: FareQuote, request: RideQuoteRequest): Promise<string | null>;
}

export interface SyncRideProvider extends BaseRideProvider {
  type: 'sync';
  getQuote(request: RideQuoteRequest): Promise<FareQuote[]>;
}

export interface AsyncRideProvider extends BaseRideProvider {
  type: 'async';
  createQuoteRequest(request: RideQuoteRequest): Promise<string>;
  onQuoteResult(callback: (reqId: string, quotes: FareQuote[], error?: Error) => void): void;
}

export type RideProvider = SyncRideProvider | AsyncRideProvider;
