import { CityKey } from '../../cityDetector';
import { estimateFare, FareBreakdown } from '../../fareEngine';
import { SyncRideProvider, ProviderConnection, RideQuoteRequest, FareQuote } from '../types';

export type VehicleTierOption = {
  category: 'Bike' | 'Auto' | 'Cab' | 'Sedan' | 'SUV';
  label: string;
  engineKey: string;
  low: number;
  high: number;
  isSurge: boolean;
  breakdown: FareBreakdown;
};

type SupportedAppConfig = {
  providerName: string;
  defaultRideType: 'Bike' | 'Auto' | 'Cab' | 'Sedan' | 'Electric';
  defaultEngineKey: string;
  tiers: {
    category: 'Bike' | 'Auto' | 'Cab' | 'Sedan' | 'SUV';
    label: string;
    engineKey: string;
  }[];
};

export class FareSnapEstimateProvider implements SyncRideProvider {
  id = 'faresnap_estimator';
  name = 'FareSnap Engine';
  type = 'sync' as const;

  private supportedApps: SupportedAppConfig[] = [
    {
      providerName: 'Uber',
      defaultRideType: 'Cab',
      defaultEngineKey: 'UberGo',
      tiers: [
        { category: 'Bike', label: 'Uber Moto', engineKey: 'UberMoto' },
        { category: 'Auto', label: 'Uber Auto', engineKey: 'UberAuto' },
        { category: 'Cab', label: 'Uber Go', engineKey: 'UberGo' },
        { category: 'Sedan', label: 'Uber Premier', engineKey: 'UberPremier' },
        { category: 'SUV', label: 'Uber XL', engineKey: 'UberXL' },
      ],
    },
    {
      providerName: 'Ola',
      defaultRideType: 'Cab',
      defaultEngineKey: 'OlaMini',
      tiers: [
        { category: 'Bike', label: 'Ola Bike', engineKey: 'OlaBike' },
        { category: 'Auto', label: 'Ola Auto', engineKey: 'OlaAuto' },
        { category: 'Cab', label: 'Ola Mini', engineKey: 'OlaMini' },
        { category: 'Sedan', label: 'Ola Prime Sedan', engineKey: 'OlaPrimeSedan' },
        { category: 'SUV', label: 'Ola Prime SUV', engineKey: 'OlaPrimeSUV' },
      ],
    },
    {
      providerName: 'Rapido',
      defaultRideType: 'Bike',
      defaultEngineKey: 'RapidoBike',
      tiers: [
        { category: 'Bike', label: 'Rapido Bike', engineKey: 'RapidoBike' },
        { category: 'Auto', label: 'Rapido Auto', engineKey: 'RapidoAuto' },
        { category: 'Cab', label: 'Rapido Cab', engineKey: 'RapidoCab' },
      ],
    },
    {
      providerName: 'Namma Yatri',
      defaultRideType: 'Auto',
      defaultEngineKey: 'NammaYatriAuto',
      tiers: [
        { category: 'Auto', label: 'Namma Yatri Auto', engineKey: 'NammaYatriAuto' },
        { category: 'Cab', label: 'Namma Yatri Cab', engineKey: 'NammaYatriCab' },
      ],
    },
    {
      providerName: 'inDrive',
      defaultRideType: 'Cab',
      defaultEngineKey: 'InDrive',
      tiers: [
        { category: 'Auto', label: 'inDrive Auto', engineKey: 'InDriveAuto' },
        { category: 'Cab', label: 'inDrive Mini', engineKey: 'InDrive' },
        { category: 'Sedan', label: 'inDrive Sedan', engineKey: 'InDriveSedan' },
      ],
    },
    {
      providerName: 'Bharat Cab',
      defaultRideType: 'Cab',
      defaultEngineKey: 'BharatCab',
      tiers: [
        { category: 'Auto', label: 'Bharat Auto', engineKey: 'BharatAuto' },
        { category: 'Cab', label: 'Bharat Mini', engineKey: 'BharatCab' },
        { category: 'Sedan', label: 'Bharat Sedan', engineKey: 'BharatSedan' },
      ],
    },
    {
      providerName: 'Meru Cabs',
      defaultRideType: 'Sedan',
      defaultEngineKey: 'Meru',
      tiers: [{ category: 'Sedan', label: 'Meru Sedan', engineKey: 'Meru' }],
    },
    {
      providerName: 'Savaari',
      defaultRideType: 'Sedan',
      defaultEngineKey: 'Savaari',
      tiers: [
        { category: 'Sedan', label: 'Savaari AC Sedan', engineKey: 'Savaari' },
        { category: 'SUV', label: 'Savaari Innova SUV', engineKey: 'SavaariSUV' },
      ],
    },
    {
      providerName: 'BluSmart',
      defaultRideType: 'Electric',
      defaultEngineKey: 'BluSmart',
      tiers: [{ category: 'Cab', label: 'BluSmart Electric', engineKey: 'BluSmart' }],
    },
  ];

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      providerId: this.id,
      status: 'connected',
    };
  }

  async isAvailable(city: CityKey): Promise<boolean> {
    return true;
  }

  async getQuote(request: RideQuoteRequest): Promise<FareQuote[]> {
    const quotes: FareQuote[] = [];

    for (const app of this.supportedApps) {
      const estimate = estimateFare(
        app.defaultEngineKey,
        request.city,
        request.distanceKm,
        request.durationMin
      );

      const availableTiers: VehicleTierOption[] = [];
      for (const t of app.tiers) {
        const tierEst = estimateFare(
          t.engineKey,
          request.city,
          request.distanceKm,
          request.durationMin
        );
        if (tierEst.available) {
          availableTiers.push({
            category: t.category,
            label: t.label,
            engineKey: t.engineKey,
            low: tierEst.low,
            high: tierEst.high,
            isSurge: tierEst.isSurge,
            breakdown: tierEst.breakdown,
          });
        }
      }

      const autoTier = availableTiers.find((t) => t.category === 'Auto');

      if (estimate.available) {
        quotes.push({
          providerId: app.providerName.toLowerCase().replace(/\s+/g, '_'),
          providerName: app.providerName,
          rideType: app.defaultRideType,
          price: estimate.low,
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
            breakdown: estimate.breakdown,
            tiers: availableTiers,
            ...(autoTier
              ? {
                  autoLowEstimate: autoTier.low,
                  autoHighEstimate: autoTier.high,
                }
              : {}),
          },
        });
      } else {
        quotes.push({
          providerId: app.providerName.toLowerCase().replace(/\s+/g, '_'),
          providerName: app.providerName,
          rideType: app.defaultRideType,
          price: null,
          currency: 'INR',
          etaMinutes: null,
          distanceKm: request.distanceKm,
          source: 'faresnap_estimate',
          confidence: 'estimated',
          fetchedAt: new Date().toISOString(),
          isAvailable: false,
          metadata: {
            unavailableReason: estimate.reason,
            tiers: availableTiers,
          },
        });
      }
    }

    return quotes;
  }
}
