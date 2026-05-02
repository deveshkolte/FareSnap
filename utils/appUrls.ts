// Utility functions to get mobile web and native deep link URLs for ride booking apps

type LocationData = {
  lat?: number;
  lng?: number;
  address: string;
};

export const getAppUrl = (appName: string, origin: LocationData, destination: LocationData): string => {
  const encodedOrigin = encodeURIComponent(origin.address);
  const encodedDest = encodeURIComponent(destination.address);

  switch (appName) {
    case 'Uber':
      if (origin.lat && origin.lng && destination.lat && destination.lng) {
        return `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${origin.lat}&pickup[longitude]=${origin.lng}&pickup[nickname]=${encodedOrigin}&dropoff[latitude]=${destination.lat}&dropoff[longitude]=${destination.lng}&dropoff[nickname]=${encodedDest}`;
      } else {
        return 'https://m.uber.com/ul/';
      }
    case 'Ola':
      if (origin.lat && origin.lng && destination.lat && destination.lng) {
        return `https://book.olacabs.com/?pickup_lat=${origin.lat}&pickup_lng=${origin.lng}&drop_lat=${destination.lat}&drop_lng=${destination.lng}&pickup_name=${encodedOrigin}&drop_name=${encodedDest}`;
      } else {
        return 'https://book.olacabs.com/';
      }
    case 'Rapido':
      return 'https://rapido.bike';
    case 'Namma Yatri':
      return 'https://nammayatri.in';
    case 'BluSmart':
      return 'https://blu-smart.com';
    case 'Meru':
      return 'https://merucabs.com';
    case 'InDrive':
      return 'https://indrive.com';
    case 'Porter':
      return 'https://porter.in';
    case 'Jugnoo':
      return 'https://jugnoo.in';
    default:
      return 'https://google.com/maps';
  }
};

export const getDeepLink = (appName: string, origin: LocationData, destination: LocationData): string => {
  const encodedOrigin = encodeURIComponent(origin.address);
  const encodedDest = encodeURIComponent(destination.address);

  switch (appName) {
    case 'Uber':
      if (origin.lat && origin.lng && destination.lat && destination.lng) {
        return `uber://?action=setPickup&pickup[latitude]=${origin.lat}&pickup[longitude]=${origin.lng}&pickup[nickname]=${encodedOrigin}&dropoff[latitude]=${destination.lat}&dropoff[longitude]=${destination.lng}&dropoff[nickname]=${encodedDest}`;
      } else {
        return 'uber://';
      }
    case 'Ola':
      if (origin.lat && origin.lng && destination.lat && destination.lng) {
        return `olacabs://app/launching?pickup_lat=${origin.lat}&pickup_lng=${origin.lng}&drop_lat=${destination.lat}&drop_lng=${destination.lng}&pickup_name=${encodedOrigin}&drop_name=${encodedDest}`;
      } else {
        return 'olacabs://app/launching';
      }
    case 'Rapido':
      return 'in.rapido.passanger://';
    case 'Namma Yatri':
      return 'https://nammayatri.in';
    case 'BluSmart':
      return 'https://blu-smart.com';
    case 'Meru':
      return 'https://merucabs.com';
    case 'InDrive':
      return 'https://indrive.com';
    case 'Porter':
      return 'https://porter.in';
    case 'Jugnoo':
      return 'https://jugnoo.in';
    default:
      return getAppUrl(appName, origin, destination);
  }
};