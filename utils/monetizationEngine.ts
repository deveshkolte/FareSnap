import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

export type MonetizationSlotId =
  | 'airport_chauffeur_affiliate'
  | 'spend_lens_cashback_card'
  | 'payment_sheet_upi_reward'
  | 'post_ride_partner_perk';

export type RemoteMonetizationConfig = {
  enabled: boolean;
  cuelinksPubId: string;
  savaariAffiliateUrl: string;
  cashbackCardTitle: string;
  cashbackCardSubtitle: string;
  cashbackCardCta: string;
  cashbackOfferUrl: string;
  upiRewardTitle: string;
  upiReferralUrl: string;
  postRidePerkTitle: string;
  postRidePerkUrl: string;
};

const CLOUD_BAP_URL = (
  process.env.EXPO_PUBLIC_ONDC_BAP_URL ||
  'https://faresnap-ondc-bap-gateway.onrender.com'
).replace(/\/$/, '');

const DEFAULT_MONETIZATION_CONFIG: RemoteMonetizationConfig = {
  enabled: true,
  cuelinksPubId: process.env.EXPO_PUBLIC_CUELINKS_PUB_ID || '',
  savaariAffiliateUrl:
    process.env.EXPO_PUBLIC_SAVAARI_AFFILIATE_URL ||
    'https://www.savaari.com/?utm_source=faresnap&utm_medium=affiliate',
  cashbackCardTitle: 'Get 5% Cashback on Uber, Ola & Rapido',
  cashbackCardSubtitle:
    'Commuters save an extra 5% on every cab, auto & bike ride with zero-fee UPI & RuPay cashback.',
  cashbackCardCta: 'Unlock 5% Ride Cashback →',
  cashbackOfferUrl:
    process.env.EXPO_PUBLIC_CASHBACK_OFFER_URL ||
    'https://super.money/?utm_source=faresnap',
  upiRewardTitle: '🎁 Get up to 5% cashback on Ride UPI payments →',
  upiReferralUrl:
    process.env.EXPO_PUBLIC_UPI_REFERRAL_URL ||
    'https://super.money/?utm_source=faresnap_upi',
  postRidePerkTitle: '💳 Earn 5% back on this ride with Super UPI / Cashback →',
  postRidePerkUrl:
    process.env.EXPO_PUBLIC_CASHBACK_OFFER_URL ||
    'https://super.money/?utm_source=faresnap_postride',
};

let cachedConfig: RemoteMonetizationConfig = DEFAULT_MONETIZATION_CONFIG;

export function getMonetizationConfig(): RemoteMonetizationConfig {
  return cachedConfig;
}

/**
 * Fetches hot-updatable affiliate & referral URLs from the Render cloud backend
 * so payout links can be updated anytime without rebuilding the APK.
 */
export async function refreshMonetizationConfig(): Promise<RemoteMonetizationConfig> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${CLOUD_BAP_URL}/monetization-config`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        cachedConfig = {
          ...DEFAULT_MONETIZATION_CONFIG,
          ...data,
        };
      }
    }
  } catch {}
  return cachedConfig;
}

/**
 * Records a monetization click/handoff on the cloud backend for revenue tracking.
 */
export function trackMonetizationClick(
  slotId: MonetizationSlotId,
  providerOrLabel: string,
  estimatedRideValue?: number
): void {
  fetch(`${CLOUD_BAP_URL}/monetization-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slotId,
      providerOrLabel,
      estimatedRideValue: estimatedRideValue ?? 0,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {});
}

/**
 * Wraps an outbound web booking URL with Cuelinks universal affiliate tracking
 * (or provider-specific affiliate URL) when available.
 */
export function wrapWithAffiliateTracking(
  appName: string,
  rawWebUrl: string
): string {
  const cfg = cachedConfig;
  if (!cfg.enabled) return rawWebUrl;

  if (appName === 'Savaari') {
    trackMonetizationClick('airport_chauffeur_affiliate', 'Savaari');
    const baseTarget = cfg.savaariAffiliateUrl || rawWebUrl;
    if (cfg.cuelinksPubId) {
      return `https://linksredirect.com/?pub_id=${encodeURIComponent(
        cfg.cuelinksPubId
      )}&source=linkkit&url=${encodeURIComponent(baseTarget)}`;
    }
    return baseTarget;
  }

  if (cfg.cuelinksPubId && /^https?:\/\//i.test(rawWebUrl)) {
    return `https://linksredirect.com/?pub_id=${encodeURIComponent(
      cfg.cuelinksPubId
    )}&source=linkkit&url=${encodeURIComponent(rawWebUrl)}`;
  }

  return rawWebUrl;
}

/**
 * Opens a partner/referral offer URL and logs the conversion click.
 */
export async function openPartnerOffer(
  slotId: MonetizationSlotId,
  label: string,
  targetUrl: string
): Promise<void> {
  trackMonetizationClick(slotId, label);
  const cfg = cachedConfig;
  const finalUrl =
    cfg.cuelinksPubId &&
    !targetUrl.includes('linksredirect.com') &&
    /^https?:\/\//i.test(targetUrl)
      ? `https://linksredirect.com/?pub_id=${encodeURIComponent(
          cfg.cuelinksPubId
        )}&source=linkkit&url=${encodeURIComponent(targetUrl)}`
      : targetUrl;

  try {
    const canOpen = await Linking.canOpenURL(finalUrl);
    if (canOpen) {
      await Linking.openURL(finalUrl);
      return;
    }
  } catch {}
  await WebBrowser.openBrowserAsync(finalUrl);
}
