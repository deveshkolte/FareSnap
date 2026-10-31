import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScrapedLiveProduct } from './liveSessionBridge';

const NY_API_BASE = 'https://api.moving.tech/pilot/app/v2';
const NY_TOKEN_KEY = 'faresnap_ny_live_token_v1';

export async function getStoredNammaYatriToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NY_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredNammaYatriToken(
  token: string | null
): Promise<void> {
  try {
    if (token) {
      await AsyncStorage.setItem(NY_TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(NY_TOKEN_KEY);
    }
  } catch {}
}

/**
 * Initiates a real OTP login request against Namma Yatri's production backend (`api.moving.tech`).
 */
export async function sendNammaYatriOtp(
  mobileNumber: string
): Promise<{ authId: string; attempts?: number }> {
  const cleanPhone = mobileNumber.replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    throw new Error('Enter a valid 10-digit Indian mobile number.');
  }

  const res = await fetch(`${NY_API_BASE}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mobileNumber: cleanPhone,
      mobileCountryCode: '+91',
      merchantId: 'NAMMA_YATRI',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.authId) {
    throw new Error(
      data?.errorMessage || data?.errorCode || `Failed to send OTP (HTTP ${res.status})`
    );
  }

  return {
    authId: String(data.authId),
    attempts: data.attempts,
  };
}

/**
 * Verifies the 4-digit OTP with Namma Yatri's production backend and stores the session token.
 */
export async function verifyNammaYatriOtp(
  authId: string,
  otp: string
): Promise<{ token: string }> {
  const cleanOtp = otp.replace(/\D/g, '').trim();
  if (cleanOtp.length < 4) {
    throw new Error('Enter the 4-digit OTP sent to your phone.');
  }

  const res = await fetch(
    `${NY_API_BASE}/auth/${encodeURIComponent(authId)}/verify`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        otp: cleanOtp,
        deviceToken: 'faresnap-mobile-client',
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.token) {
    throw new Error(
      data?.errorMessage || data?.errorCode || 'Invalid OTP. Please try again.'
    );
  }

  const token = String(data.token);
  await setStoredNammaYatriToken(token);
  return { token };
}

/**
 * Queries live ride estimates directly from Namma Yatri's production `/rideSearch` endpoint
 * using the user's authenticated session token.
 */
export async function fetchNammaYatriLiveFares(opts: {
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropLat: number;
  dropLng: number;
  dropAddress: string;
  cityLabel: string;
}): Promise<ScrapedLiveProduct[]> {
  const token = await getStoredNammaYatriToken();
  if (!token) return [];

  try {
    const searchBody = {
      fareProductType: 'ONE_WAY',
      contents: {
        origin: {
          address: {
            area: opts.pickupAddress.split(',')[0] || opts.pickupAddress,
            city: opts.cityLabel,
            state: 'India',
            country: 'India',
            building: null,
            door: null,
            street: null,
          },
          gps: {
            lat: opts.pickupLat,
            lon: opts.pickupLng,
          },
        },
        destination: {
          address: {
            area: opts.dropAddress.split(',')[0] || opts.dropAddress,
            city: opts.cityLabel,
            state: 'India',
            country: 'India',
            building: null,
            door: null,
            street: null,
          },
          gps: {
            lat: opts.dropLat,
            lon: opts.dropLng,
          },
        },
      },
    };

    const searchRes = await fetch(`${NY_API_BASE}/rideSearch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token,
      },
      body: JSON.stringify(searchBody),
    });

    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const searchId = searchData?.searchId;
    if (!searchId) return [];

    // Poll `/rideSearch/{searchId}/results` for incoming driver/tier estimates
    for (const waitMs of [900, 1100]) {
      await new Promise((r) => setTimeout(r, waitMs));
      const res = await fetch(
        `${NY_API_BASE}/rideSearch/${encodeURIComponent(searchId)}/results`,
        {
          headers: {
            'Content-Type': 'application/json',
            token,
          },
        }
      );
      if (!res.ok) break;
      const resultData = await res.json();
      const estimates: any[] = resultData?.estimates || [];
      if (estimates.length > 0) {
        return estimates
          .map((est): ScrapedLiveProduct | null => {
            const tierName = String(
              est.serviceTierName || est.vehicleVariant || 'Auto Direct'
            );
            const fare = Number(
              est.estimatedFare ?? est.minFare ?? est.totalFare ?? 0
            );
            if (!Number.isFinite(fare) || fare <= 0) return null;

            const isBike = /bike|moto/i.test(tierName);
            const isAuto = /auto/i.test(tierName);

            return {
              providerId: 'namma_yatri',
              providerName: 'Namma Yatri',
              productName: isAuto ? 'Auto Direct' : tierName,
              category: isBike ? 'Bike' : isAuto ? 'Auto' : 'Cab',
              price: Math.round(fare),
              etaMinutes: est.estimatedPickupDuration
                ? Math.max(1, Math.round(Number(est.estimatedPickupDuration) / 60))
                : 3,
              estimateId: est.id ? String(est.id) : undefined,
            };
          })
          .filter((p): p is ScrapedLiveProduct => p !== null);
      }
    }
  } catch {}

  return [];
}

/**
 * Triggers direct in-app ride booking on Namma Yatri (`POST /estimate/{estimateId}/select2`)
 * when the user has linked their Namma Yatri account via OTP and received a live `estimateId`.
 */
export async function bookNammaYatriEstimate(
  estimateId: string
): Promise<{ booked: boolean; message?: string }> {
  const token = await getStoredNammaYatriToken();
  if (!token || !estimateId) {
    return { booked: false };
  }

  try {
    const res = await fetch(
      `${NY_API_BASE}/estimate/${encodeURIComponent(estimateId)}/select2`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token,
        },
        body: JSON.stringify({
          customerExtraFee: 0,
          autoAssignEnabled: true,
          autoAssignEnabledV2: true,
        }),
      }
    );
    if (res.ok) {
      return {
        booked: true,
        message: 'Namma Yatri driver search initiated on your account!',
      };
    }
  } catch {}

  return { booked: false };
}
