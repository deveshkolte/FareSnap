import { CityKey, detectCityFromCoords, normalizeCityName } from './cityDetector';

export type PlaceSuggestion = {
  name: string;
  subtitle: string;
  full: string;
  lat: number;
  lng: number;
  distanceKm?: number;
  categoryIcon: string;
  isMajorHub?: boolean;
};

export type CityMeta = {
  key: Exclude<CityKey, 'default'>;
  label: string;
  searchName: string;
  stateName: string;
  center: { lat: number; lng: number };
  bboxDeltaDeg: number;
  quickHubs: {
    Airport: PlaceSuggestion;
    'Railway Station': PlaceSuggestion;
    'Metro Station': PlaceSuggestion;
    'Tech Park': PlaceSuggestion;
  };
  landmarks: {
    name: string;
    subtitle: string;
    lat: number;
    lng: number;
    icon: string;
    aliases?: string[];
  }[];
};

export const haversineDistanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};

export const CITY_DIRECTORY: Record<Exclude<CityKey, 'default'>, CityMeta> = {
  bangalore: {
    key: 'bangalore',
    label: 'Bengaluru',
    searchName: 'Bengaluru',
    stateName: 'Karnataka',
    center: { lat: 12.9716, lng: 77.5946 },
    bboxDeltaDeg: 0.55,
    quickHubs: {
      Airport: {
        name: 'Kempegowda International Airport (BLR)',
        subtitle: 'Devanahalli, Bengaluru, Karnataka',
        full: 'Kempegowda International Airport (BLR), Devanahalli, Bengaluru',
        lat: 13.1986,
        lng: 77.7066,
        categoryIcon: '✈️',
      },
      'Railway Station': {
        name: 'KSR Bengaluru City Junction (Majestic)',
        subtitle: 'Majestic, Sevashrama, Bengaluru',
        full: 'KSR Bengaluru City Junction (Majestic), Bengaluru',
        lat: 12.9781,
        lng: 77.5697,
        categoryIcon: '🚉',
      },
      'Metro Station': {
        name: 'Indiranagar Metro Station',
        subtitle: 'CMH Road, Indiranagar, Bengaluru',
        full: 'Indiranagar Metro Station, CMH Road, Bengaluru',
        lat: 12.9784,
        lng: 77.6386,
        categoryIcon: '🚇',
      },
      'Tech Park': {
        name: 'Manyata Embassy Business Park',
        subtitle: 'Outer Ring Road, Nagawara, Bengaluru',
        full: 'Manyata Embassy Business Park, Nagawara, Bengaluru',
        lat: 13.0458,
        lng: 77.6208,
        categoryIcon: '🏢',
      },
    },
    landmarks: [
      { name: 'MG Road', subtitle: 'Shanthala Nagar, Ashok Nagar, Bengaluru', lat: 12.9756, lng: 77.6066, icon: '📍', aliases: ['mahatma gandhi road', 'brigade road'] },
      { name: 'Koramangala', subtitle: '5th Block, Koramangala, Bengaluru', lat: 12.9352, lng: 77.6245, icon: '📍', aliases: ['kormangala', 'sony world signal', '4th block', '6th block'] },
      { name: 'Indiranagar', subtitle: '100 Feet Road, Indiranagar, Bengaluru', lat: 12.9784, lng: 77.6408, icon: '📍', aliases: ['indira nagar', 'cmh road'] },
      { name: 'HSR Layout', subtitle: 'Sector 2, HSR Layout, Bengaluru', lat: 12.9121, lng: 77.6446, icon: '📍', aliases: ['hsr', 'agara'] },
      { name: 'Whitefield', subtitle: 'ITPL Main Road, Whitefield, Bengaluru', lat: 12.9698, lng: 77.75, icon: '🏢', aliases: ['itpl', 'hope farm'] },
      { name: 'Electronic City', subtitle: 'Phase 1, Hosur Road, Bengaluru', lat: 12.8452, lng: 77.6602, icon: '🏢', aliases: ['ecity', 'infosys electronic city'] },
      { name: 'Marathahalli', subtitle: 'Outer Ring Road, Marathahalli, Bengaluru', lat: 12.9592, lng: 77.6974, icon: '📍', aliases: ['marathalli', 'kalamandir'] },
      { name: 'Bellandur', subtitle: 'Outer Ring Road, Bellandur, Bengaluru', lat: 12.9304, lng: 77.6784, icon: '🏢', aliases: ['ecospace', 'rmz ecospace', 'ecoworld'] },
      { name: 'Silk Board Junction', subtitle: 'Hosur Road, Madiwala, Bengaluru', lat: 12.9177, lng: 77.6238, icon: '📍', aliases: ['central silk board', 'madiwala'] },
      { name: 'Jayanagar', subtitle: '4th Block, Jayanagar, Bengaluru', lat: 12.9299, lng: 77.5824, icon: '📍' },
      { name: 'JP Nagar', subtitle: '6th Phase, JP Nagar, Bengaluru', lat: 12.9063, lng: 77.5857, icon: '📍' },
      { name: 'BTM Layout', subtitle: '2nd Stage, BTM Layout, Bengaluru', lat: 12.9166, lng: 77.6101, icon: '📍', aliases: ['btm', 'udupi garden'] },
      { name: 'Malleshwaram', subtitle: '8th Cross, Malleshwaram, Bengaluru', lat: 13.0031, lng: 77.5643, icon: '📍', aliases: ['malleswaram', 'mantri square'] },
      { name: 'Hebbal', subtitle: 'Bellary Road, Hebbal Flyover, Bengaluru', lat: 13.0358, lng: 77.597, icon: '📍', aliases: ['esteema mall', 'hebbal flyover'] },
      { name: 'Manyata Tech Park', subtitle: 'Outer Ring Road, Nagawara, Bengaluru', lat: 13.0458, lng: 77.6208, icon: '🏢', aliases: ['manyata', 'nagawara'] },
      { name: 'Kempegowda International Airport (BLR)', subtitle: 'Devanahalli, Bengaluru', lat: 13.1986, lng: 77.7066, icon: '✈️', aliases: ['airport', 'kia', 'blr airport', 'devanahalli'] },
      { name: 'KSR Bengaluru City Junction (Majestic)', subtitle: 'Majestic Railway & Bus Stand, Bengaluru', lat: 12.9781, lng: 77.5697, icon: '🚉', aliases: ['majestic', 'railway station', 'kempegowda bus station'] },
      { name: 'Yeshwanthpur Railway Station', subtitle: 'Tumkur Road, Yeshwanthpur, Bengaluru', lat: 13.0238, lng: 77.5529, icon: '🚉', aliases: ['yeshwantpur', 'yesvantpur'] },
      { name: 'SMVT Bengaluru Railway Station', subtitle: 'Baiyappanahalli, Bengaluru', lat: 12.9997, lng: 77.6512, icon: '🚉', aliases: ['baiyappanahalli', 'smvt'] },
      { name: 'KR Puram Railway Station', subtitle: 'Old Madras Road, Krishnarajapuram, Bengaluru', lat: 13.0007, lng: 77.6746, icon: '🚉', aliases: ['krishnarajapuram', 'tin factory'] },
      { name: 'Nexus Mall Koramangala', subtitle: 'Hosur Road, Koramangala, Bengaluru', lat: 12.9345, lng: 77.6113, icon: '🛍️', aliases: ['forum mall koramangala', 'nexus forum', 'mall'] },
      { name: 'Phoenix Marketcity Mall', subtitle: 'Whitefield Main Road, Mahadevapura, Bengaluru', lat: 12.9958, lng: 77.6964, icon: '🛍️', aliases: ['phoenix mall', 'mahadevapura', 'mall'] },
      { name: 'Orion Mall', subtitle: 'Brigade Gateway, Rajajinagar, Bengaluru', lat: 13.011, lng: 77.555, icon: '🛍️', aliases: ['rajajinagar', 'world trade center', 'mall'] },
      { name: 'UB City Mall', subtitle: 'Vittal Mallya Road, Bengaluru', lat: 12.9716, lng: 77.5961, icon: '🛍️', aliases: ['vittal mallya road', 'cubbon park', 'mall'] },
      { name: 'Sarjapur Road', subtitle: 'Wipro Gate, Kaikondrahalli, Bengaluru', lat: 12.9081, lng: 77.6848, icon: '🏢', aliases: ['kaikondrahalli', 'carmelaram'] },
      { name: 'Banashankari', subtitle: '2nd Stage, Banashankari, Bengaluru', lat: 12.9255, lng: 77.5468, icon: '📍', aliases: ['bsk'] },
      { name: 'Yelahanka', subtitle: 'Yelahanka New Town, Bengaluru', lat: 13.1007, lng: 77.5963, icon: '📍' },
      { name: 'Bagmane Tech Park', subtitle: 'CV Raman Nagar, Bengaluru', lat: 12.9792, lng: 77.6606, icon: '🏢', aliases: ['cv raman nagar'] },
      { name: 'Embassy GolfLinks (EGL)', subtitle: 'Intermediate Ring Road, Domlur, Bengaluru', lat: 12.9518, lng: 77.6425, icon: '🏢', aliases: ['domlur', 'egl'] },
    ],
  },
  mumbai: {
    key: 'mumbai',
    label: 'Mumbai',
    searchName: 'Mumbai',
    stateName: 'Maharashtra',
    center: { lat: 19.076, lng: 72.8777 },
    bboxDeltaDeg: 0.55,
    quickHubs: {
      Airport: {
        name: 'Chhatrapati Shivaji Maharaj Intl Airport (T2)',
        subtitle: 'Andheri East, Mumbai, Maharashtra',
        full: 'Chhatrapati Shivaji Maharaj International Airport T2, Mumbai',
        lat: 19.0896,
        lng: 72.8656,
        categoryIcon: '✈️',
      },
      'Railway Station': {
        name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT)',
        subtitle: 'Fort, Mumbai, Maharashtra',
        full: 'Chhatrapati Shivaji Maharaj Terminus (CSMT), Fort, Mumbai',
        lat: 18.9398,
        lng: 72.8354,
        categoryIcon: '🚉',
      },
      'Metro Station': {
        name: 'Andheri Metro Station',
        subtitle: 'Andheri East, Mumbai, Maharashtra',
        full: 'Andheri Metro Station, Andheri East, Mumbai',
        lat: 19.1206,
        lng: 72.8482,
        categoryIcon: '🚇',
      },
      'Tech Park': {
        name: 'Bandra Kurla Complex (BKC)',
        subtitle: 'Bandra East, Mumbai, Maharashtra',
        full: 'Bandra Kurla Complex (BKC), Bandra East, Mumbai',
        lat: 19.0653,
        lng: 72.8677,
        categoryIcon: '🏢',
      },
    },
    landmarks: [
      { name: 'Bandra Kurla Complex (BKC)', subtitle: 'Bandra East, Mumbai', lat: 19.0653, lng: 72.8677, icon: '🏢', aliases: ['bkc', 'jio world drive'] },
      { name: 'Andheri West', subtitle: 'Lokhandwala, Andheri West, Mumbai', lat: 19.1363, lng: 72.8277, icon: '📍', aliases: ['lokhandwala', 'versova'] },
      { name: 'Andheri East', subtitle: 'Chakala, Andheri East, Mumbai', lat: 19.1136, lng: 72.8697, icon: '📍', aliases: ['chakala', 'marol'] },
      { name: 'Bandra West', subtitle: 'Linking Road, Bandra West, Mumbai', lat: 19.0596, lng: 72.8295, icon: '📍', aliases: ['linking road', 'bandstand'] },
      { name: 'Powai', subtitle: 'Hiranandani Gardens, Powai, Mumbai', lat: 19.1176, lng: 72.906, icon: '🏢', aliases: ['hiranandani powai', 'iit bombay'] },
      { name: 'Lower Parel', subtitle: 'Kamala Mills, Lower Parel, Mumbai', lat: 18.9953, lng: 72.829, icon: '🏢', aliases: ['phoenix palladium', 'kamala mills'] },
      { name: 'Dadar Station', subtitle: 'Dadar West, Mumbai', lat: 19.0178, lng: 72.8478, icon: '🚉' },
      { name: 'Juhu Beach', subtitle: 'Juhu Tara Road, Juhu, Mumbai', lat: 19.0988, lng: 72.8264, icon: '📍' },
      { name: 'Colaba Causeway', subtitle: 'Gateway of India, Colaba, Mumbai', lat: 18.922, lng: 72.8347, icon: '📍', aliases: ['gateway of india', 'nariman point'] },
      { name: 'Goregaon East', subtitle: 'Oberoi Mall, Nesco, Goregaon, Mumbai', lat: 19.1663, lng: 72.8526, icon: '🏢', aliases: ['nesco', 'mindspace malad', 'malad'] },
      { name: 'Thane West', subtitle: 'Viviana Mall, Thane, Mumbai MMR', lat: 19.2183, lng: 72.9781, icon: '📍' },
      { name: 'Vashi', subtitle: 'Inorbit Mall, Navi Mumbai', lat: 19.0745, lng: 72.9978, icon: '📍', aliases: ['navi mumbai', 'belapur', 'nerul'] },
    ],
  },
  delhi: {
    key: 'delhi',
    label: 'Delhi NCR',
    searchName: 'New Delhi',
    stateName: 'Delhi',
    center: { lat: 28.6139, lng: 77.209 },
    bboxDeltaDeg: 0.6,
    quickHubs: {
      Airport: {
        name: 'Indira Gandhi International Airport (T3)',
        subtitle: 'Aerocity, New Delhi',
        full: 'Indira Gandhi International Airport Terminal 3, New Delhi',
        lat: 28.5562,
        lng: 77.1,
        categoryIcon: '✈️',
      },
      'Railway Station': {
        name: 'New Delhi Railway Station (NDLS)',
        subtitle: 'Paharganj / Ajmeri Gate, New Delhi',
        full: 'New Delhi Railway Station, Ajmeri Gate, New Delhi',
        lat: 28.6429,
        lng: 77.2191,
        categoryIcon: '🚉',
      },
      'Metro Station': {
        name: 'Rajiv Chowk Metro Station',
        subtitle: 'Connaught Place, New Delhi',
        full: 'Rajiv Chowk Metro Station, Connaught Place, New Delhi',
        lat: 28.6328,
        lng: 77.2197,
        categoryIcon: '🚇',
      },
      'Tech Park': {
        name: 'DLF CyberHub',
        subtitle: 'DLF Phase 2, Gurugram, Delhi NCR',
        full: 'DLF CyberHub, DLF Cyber City, Gurugram',
        lat: 28.495,
        lng: 77.0895,
        categoryIcon: '🏢',
      },
    },
    landmarks: [
      { name: 'Connaught Place (CP)', subtitle: 'Rajiv Chowk, New Delhi', lat: 28.6315, lng: 77.2167, icon: '📍', aliases: ['cp', 'rajiv chowk'] },
      { name: 'Hauz Khas', subtitle: 'South Delhi, New Delhi', lat: 28.5494, lng: 77.2001, icon: '📍', aliases: ['green park', 'saket'] },
      { name: 'Select CITYWALK Mall', subtitle: 'Saket District Centre, New Delhi', lat: 28.5286, lng: 77.2193, icon: '🛍️', aliases: ['saket mall'] },
      { name: 'DLF Cyber City', subtitle: 'Phase 2, Gurugram, Haryana', lat: 28.495, lng: 77.0895, icon: '🏢', aliases: ['cyberhub', 'gurgaon', 'gurugram'] },
      { name: 'Noida Sector 62', subtitle: 'Electronic City, Noida, UP', lat: 28.6279, lng: 77.3649, icon: '🏢', aliases: ['noida sector 18', 'dlf mall of india'] },
      { name: 'Karol Bagh', subtitle: 'Central Delhi, New Delhi', lat: 28.6514, lng: 77.1907, icon: '📍' },
      { name: 'Lajpat Nagar', subtitle: 'Central Market, South Delhi', lat: 28.5677, lng: 77.2433, icon: '📍', aliases: ['nehru place', 'greater kailash'] },
      { name: 'Dwarka Sector 21', subtitle: 'Dwarka, New Delhi', lat: 28.5522, lng: 77.0583, icon: '🚇' },
    ],
  },
  hyderabad: {
    key: 'hyderabad',
    label: 'Hyderabad',
    searchName: 'Hyderabad',
    stateName: 'Telangana',
    center: { lat: 17.385, lng: 78.4867 },
    bboxDeltaDeg: 0.55,
    quickHubs: {
      Airport: {
        name: 'Rajiv Gandhi International Airport (HYD)',
        subtitle: 'Shamshabad, Hyderabad, Telangana',
        full: 'Rajiv Gandhi International Airport, Shamshabad, Hyderabad',
        lat: 17.2403,
        lng: 78.4294,
        categoryIcon: '✈️',
      },
      'Railway Station': {
        name: 'Secunderabad Junction Railway Station',
        subtitle: 'Regimental Bazaar, Secunderabad, Hyderabad',
        full: 'Secunderabad Junction Railway Station, Hyderabad',
        lat: 17.4337,
        lng: 78.5016,
        categoryIcon: '🚉',
      },
      'Metro Station': {
        name: 'Ameerpet Metro Station',
        subtitle: 'Ameerpet, Hyderabad, Telangana',
        full: 'Ameerpet Metro Station, Hyderabad',
        lat: 17.4357,
        lng: 78.4446,
        categoryIcon: '🚇',
      },
      'Tech Park': {
        name: 'Raheja Mindspace HITEC City',
        subtitle: 'Madhapur, HITEC City, Hyderabad',
        full: 'Raheja Mindspace IT Park, HITEC City, Hyderabad',
        lat: 17.4418,
        lng: 78.3772,
        categoryIcon: '🏢',
      },
    },
    landmarks: [
      { name: 'HITEC City', subtitle: 'Madhapur, Hyderabad', lat: 17.4435, lng: 78.3772, icon: '🏢', aliases: ['hitech city', 'cyber towers', 'madhapur'] },
      { name: 'Gachibowli', subtitle: 'Financial District, Hyderabad', lat: 17.4401, lng: 78.3489, icon: '🏢', aliases: ['dlf gachibowli', 'financial district', 'nanakramguda'] },
      { name: 'Banjara Hills', subtitle: 'Road No 12, Banjara Hills, Hyderabad', lat: 17.4156, lng: 78.4347, icon: '📍', aliases: ['gvk one'] },
      { name: 'Jubilee Hills', subtitle: 'Checkpost, Jubilee Hills, Hyderabad', lat: 17.4319, lng: 78.4071, icon: '📍' },
      { name: 'Kondapur', subtitle: 'Sarath City Capital Mall, Hyderabad', lat: 17.4589, lng: 78.3658, icon: '🛍️', aliases: ['sarath city mall', 'inorbit mall hyderabad'] },
      { name: 'Kukatpally (KPHB)', subtitle: 'KPHB Colony, Hyderabad', lat: 17.4849, lng: 78.4138, icon: '📍', aliases: ['kphb', 'nexus hyderabad mall'] },
      { name: 'Begumpet', subtitle: 'Punjagutta, Hyderabad', lat: 17.4447, lng: 78.4664, icon: '📍' },
      { name: 'Charminar', subtitle: 'Old City, Hyderabad', lat: 17.3616, lng: 78.4747, icon: '📍' },
    ],
  },
  pune: {
    key: 'pune',
    label: 'Pune',
    searchName: 'Pune',
    stateName: 'Maharashtra',
    center: { lat: 18.5204, lng: 73.8567 },
    bboxDeltaDeg: 0.48,
    quickHubs: {
      Airport: {
        name: 'Pune International Airport (PNQ)',
        subtitle: 'Lohegaon, Pune, Maharashtra',
        full: 'Pune International Airport, Lohegaon, Pune',
        lat: 18.5822,
        lng: 73.9197,
        categoryIcon: '✈️',
      },
      'Railway Station': {
        name: 'Pune Junction Railway Station',
        subtitle: 'Agarkar Nagar, Pune, Maharashtra',
        full: 'Pune Junction Railway Station, Pune',
        lat: 18.5289,
        lng: 73.8744,
        categoryIcon: '🚉',
      },
      'Metro Station': {
        name: 'Shivajinagar Metro Station',
        subtitle: 'JM Road, Shivajinagar, Pune',
        full: 'Shivajinagar Metro Station, Pune',
        lat: 18.5314,
        lng: 73.8515,
        categoryIcon: '🚇',
      },
      'Tech Park': {
        name: 'Rajiv Gandhi Infotech Park (Hinjawadi)',
        subtitle: 'Phase 1, Hinjawadi, Pune',
        full: 'Rajiv Gandhi Infotech Park Phase 1, Hinjawadi, Pune',
        lat: 18.5913,
        lng: 73.7389,
        categoryIcon: '🏢',
      },
    },
    landmarks: [
      { name: 'Hinjawadi Phase 1', subtitle: 'Rajiv Gandhi Infotech Park, Pune', lat: 18.5913, lng: 73.7389, icon: '🏢', aliases: ['hinjewadi', 'wakad'] },
      { name: 'Viman Nagar', subtitle: 'Phoenix Marketcity, Viman Nagar, Pune', lat: 18.5679, lng: 73.9143, icon: '🛍️', aliases: ['phoenix mall pune', 'kalyani nagar'] },
      { name: 'Koregaon Park', subtitle: 'North Main Road, Koregaon Park, Pune', lat: 18.5362, lng: 73.894, icon: '📍', aliases: ['kp'] },
      { name: 'Kharadi EON IT Park', subtitle: 'World Trade Center, Kharadi, Pune', lat: 18.5515, lng: 73.9517, icon: '🏢', aliases: ['eon it park', 'magarpatta', 'hadapsar'] },
      { name: 'Baner', subtitle: 'Balewadi High Street, Baner, Pune', lat: 18.559, lng: 73.7868, icon: '📍', aliases: ['balewadi', 'aundh'] },
      { name: 'Kothrud', subtitle: 'Karve Road, Kothrud, Pune', lat: 18.5074, lng: 73.8077, icon: '📍', aliases: ['fc road', 'deccan gymkhana', 'swargate'] },
    ],
  },
  chennai: {
    key: 'chennai',
    label: 'Chennai',
    searchName: 'Chennai',
    stateName: 'Tamil Nadu',
    center: { lat: 13.0827, lng: 80.2707 },
    bboxDeltaDeg: 0.52,
    quickHubs: {
      Airport: {
        name: 'Chennai International Airport (MAA)',
        subtitle: 'Meenambakkam, Chennai, Tamil Nadu',
        full: 'Chennai International Airport, Meenambakkam, Chennai',
        lat: 12.9941,
        lng: 80.1709,
        categoryIcon: '✈️',
      },
      'Railway Station': {
        name: 'MGR Chennai Central Railway Station',
        subtitle: 'Park Town, Chennai, Tamil Nadu',
        full: 'MGR Chennai Central Railway Station, Chennai',
        lat: 13.0822,
        lng: 80.2755,
        categoryIcon: '🚉',
      },
      'Metro Station': {
        name: 'Alandur Metro Station',
        subtitle: 'GST Road, Alandur, Chennai',
        full: 'Alandur Metro Station, Chennai',
        lat: 13.0042,
        lng: 80.2015,
        categoryIcon: '🚇',
      },
      'Tech Park': {
        name: 'TIDEL Park (OMR)',
        subtitle: 'Rajiv Gandhi Salai, Taramani, Chennai',
        full: 'TIDEL Park, Taramani, OMR, Chennai',
        lat: 12.9896,
        lng: 80.2485,
        categoryIcon: '🏢',
      },
    },
    landmarks: [
      { name: 'T. Nagar', subtitle: 'Usman Road, Thyagaraya Nagar, Chennai', lat: 13.0418, lng: 80.2341, icon: '📍', aliases: ['tnagar', 'pondicherry bazaar'] },
      { name: 'Adyar', subtitle: 'Sardar Patel Road, Adyar, Chennai', lat: 13.0012, lng: 80.2565, icon: '📍', aliases: ['besant nagar', 'thiruvanmiyur'] },
      { name: 'Velachery', subtitle: 'Phoenix Marketcity, Velachery, Chennai', lat: 12.9759, lng: 80.2212, icon: '🛍️', aliases: ['phoenix mall chennai', 'guindy'] },
      { name: 'Anna Nagar', subtitle: '2nd Avenue, Anna Nagar, Chennai', lat: 13.085, lng: 80.2101, icon: '📍', aliases: ['vr chennai', 'koyambedu'] },
      { name: 'OMR Sholinganallur', subtitle: 'IT Corridor, Rajiv Gandhi Salai, Chennai', lat: 12.901, lng: 80.2279, icon: '🏢', aliases: ['omr', 'siruseri', 'perungudi', 'thoraipakkam'] },
      { name: 'Nungambakkam', subtitle: 'Express Avenue, Thousand Lights, Chennai', lat: 13.0569, lng: 80.2425, icon: '📍', aliases: ['egmore', 'mylapore', 'marina beach'] },
    ],
  },
  kolkata: {
    key: 'kolkata',
    label: 'Kolkata',
    searchName: 'Kolkata',
    stateName: 'West Bengal',
    center: { lat: 22.5726, lng: 88.3639 },
    bboxDeltaDeg: 0.5,
    quickHubs: {
      Airport: {
        name: 'Netaji Subhas Chandra Bose Intl Airport (CCU)',
        subtitle: 'Dum Dum, Kolkata, West Bengal',
        full: 'Netaji Subhas Chandra Bose International Airport, Dum Dum, Kolkata',
        lat: 22.652,
        lng: 88.4463,
        categoryIcon: '✈️',
      },
      'Railway Station': {
        name: 'Howrah Junction Railway Station',
        subtitle: 'Howrah, Kolkata, West Bengal',
        full: 'Howrah Junction Railway Station, Kolkata',
        lat: 22.583,
        lng: 88.3426,
        categoryIcon: '🚉',
      },
      'Metro Station': {
        name: 'Park Street Metro Station',
        subtitle: 'Park Street, Maidan, Kolkata',
        full: 'Park Street Metro Station, Kolkata',
        lat: 22.5535,
        lng: 88.3522,
        categoryIcon: '🚇',
      },
      'Tech Park': {
        name: 'Salt Lake Sector V (IT Hub)',
        subtitle: 'Bidhannagar, Kolkata, West Bengal',
        full: 'Salt Lake Sector V, Bidhannagar, Kolkata',
        lat: 22.5769,
        lng: 88.4337,
        categoryIcon: '🏢',
      },
    },
    landmarks: [
      { name: 'Park Street', subtitle: 'Central Kolkata, West Bengal', lat: 22.5529, lng: 88.3532, icon: '📍', aliases: ['esplanade', 'new market', 'victoria memorial'] },
      { name: 'Salt Lake Sector V', subtitle: 'Bidhannagar IT Hub, Kolkata', lat: 22.5769, lng: 88.4337, icon: '🏢', aliases: ['salt lake', 'city centre 1'] },
      { name: 'New Town Action Area I', subtitle: 'Biswa Bangla Gate, Rajarhat, Kolkata', lat: 22.5805, lng: 88.4607, icon: '🏢', aliases: ['rajarhat', 'ecospace kolkata', 'axis mall'] },
      { name: 'Ballygunge', subtitle: 'Quest Mall, South Kolkata', lat: 22.5326, lng: 88.3659, icon: '🛍️', aliases: ['gariahat', 'jadavpur', 'tollygunge', 'south city mall'] },
      { name: 'Sealdah Railway Station', subtitle: 'Bepin Behari Ganguly St, Kolkata', lat: 22.5674, lng: 88.3711, icon: '🚉' },
    ],
  },
  ahmedabad: {
    key: 'ahmedabad',
    label: 'Ahmedabad',
    searchName: 'Ahmedabad',
    stateName: 'Gujarat',
    center: { lat: 23.0225, lng: 72.5714 },
    bboxDeltaDeg: 0.48,
    quickHubs: {
      Airport: {
        name: 'Sardar Vallabhbhai Patel Intl Airport (AMD)',
        subtitle: 'Hansol, Ahmedabad, Gujarat',
        full: 'Sardar Vallabhbhai Patel International Airport, Ahmedabad',
        lat: 23.0734,
        lng: 72.6266,
        categoryIcon: '✈️',
      },
      'Railway Station': {
        name: 'Ahmedabad Junction (Kalupur)',
        subtitle: 'Kalupur, Ahmedabad, Gujarat',
        full: 'Ahmedabad Junction Railway Station, Kalupur, Ahmedabad',
        lat: 23.0268,
        lng: 72.6011,
        categoryIcon: '🚉',
      },
      'Metro Station': {
        name: 'Thaltej Metro Station',
        subtitle: 'SG Highway, Thaltej, Ahmedabad',
        full: 'Thaltej Metro Station, SG Highway, Ahmedabad',
        lat: 23.0497,
        lng: 72.5171,
        categoryIcon: '🚇',
      },
      'Tech Park': {
        name: 'GIFT City / SG Highway Corporate Road',
        subtitle: 'Prahlad Nagar, SG Highway, Ahmedabad',
        full: 'Prahlad Nagar Corporate Road, SG Highway, Ahmedabad',
        lat: 23.012,
        lng: 72.5108,
        categoryIcon: '🏢',
      },
    },
    landmarks: [
      { name: 'SG Highway', subtitle: 'Bodakdev / Thaltej, Ahmedabad', lat: 23.0402, lng: 72.5146, icon: '🏢', aliases: ['prahlad nagar', 'satellite', 'palladium ahmedabad'] },
      { name: 'Navrangpura (CG Road)', subtitle: 'Chimanlal Girdharlal Rd, Ahmedabad', lat: 23.0365, lng: 72.5611, icon: '📍', aliases: ['cg road', 'law garden', 'vastrapur'] },
      { name: 'Maninagar', subtitle: 'South Ahmedabad, Gujarat', lat: 22.9962, lng: 72.6024, icon: '📍', aliases: ['kankaria'] },
      { name: 'GIFT City', subtitle: 'Gandhinagar, Ahmedabad Metro Region', lat: 23.1645, lng: 72.6841, icon: '🏢', aliases: ['gandhinagar', 'infocity'] },
    ],
  },
  jaipur: {
    key: 'jaipur',
    label: 'Jaipur',
    searchName: 'Jaipur',
    stateName: 'Rajasthan',
    center: { lat: 26.9124, lng: 75.7873 },
    bboxDeltaDeg: 0.45,
    quickHubs: {
      Airport: {
        name: 'Jaipur International Airport (JAI)',
        subtitle: 'Sanganer, Jaipur, Rajasthan',
        full: 'Jaipur International Airport, Sanganer, Jaipur',
        lat: 26.8289,
        lng: 75.8056,
        categoryIcon: '✈️',
      },
      'Railway Station': {
        name: 'Jaipur Junction Railway Station',
        subtitle: 'Hasanpura, Jaipur, Rajasthan',
        full: 'Jaipur Junction Railway Station, Jaipur',
        lat: 26.9196,
        lng: 75.7878,
        categoryIcon: '🚉',
      },
      'Metro Station': {
        name: 'Mansarovar Metro Station',
        subtitle: 'New Sanganer Road, Jaipur',
        full: 'Mansarovar Metro Station, Jaipur',
        lat: 26.8795,
        lng: 75.7595,
        categoryIcon: '🚇',
      },
      'Tech Park': {
        name: 'Sitapura Industrial & IT Park',
        subtitle: 'Tonk Road, Sitapura, Jaipur',
        full: 'Sitapura IT Park, Tonk Road, Jaipur',
        lat: 26.7785,
        lng: 75.8414,
        categoryIcon: '🏢',
      },
    },
    landmarks: [
      { name: 'Malviya Nagar (World Trade Park)', subtitle: 'JLN Marg, Jaipur', lat: 26.853, lng: 75.8047, icon: '🛍️', aliases: ['wtp', 'world trade park', 'jln marg'] },
      { name: 'MI Road (Panch Batti)', subtitle: 'Mirza Ismail Road, Pink City, Jaipur', lat: 26.916, lng: 75.809, icon: '📍', aliases: ['hawa mahal', 'bapu bazaar', 'c scheme'] },
      { name: 'Vaishali Nagar', subtitle: 'Amrapali Marg, Jaipur', lat: 26.9115, lng: 75.7414, icon: '📍', aliases: ['mansarovar', 'raja park'] },
    ],
  },
};

const inferCategoryIcon = (text: string, osmType?: string): string => {
  const lower = `${text} ${osmType || ''}`.toLowerCase();
  if (lower.includes('airport') || lower.includes('aerodrome') || lower.includes('terminal')) {
    return '✈️';
  }
  if (lower.includes('metro')) {
    return '🚇';
  }
  if (lower.includes('railway') || lower.includes('junction') || lower.includes('station')) {
    return '🚉';
  }
  if (lower.includes('mall') || lower.includes('plaza') || lower.includes('market')) {
    return '🛍️';
  }
  if (
    lower.includes('tech') ||
    lower.includes('park') ||
    lower.includes('embassy') ||
    lower.includes('prestig') ||
    lower.includes('rmz') ||
    lower.includes('mindspace') ||
    lower.includes('cyber') ||
    lower.includes('itpl')
  ) {
    return '🏢';
  }
  if (lower.includes('hospital') || lower.includes('apollo') || lower.includes('manipal') || lower.includes('fortis')) {
    return '🏥';
  }
  return '📍';
};

/**
 * Returns default popular destination/pickup suggestions for the active city
 * when the user focuses an input field before typing or clicks a Quick Hub.
 */
export const getPopularCitySuggestions = (
  cityKey: CityKey,
  anchorCoords?: { lat: number; lng: number }
): PlaceSuggestion[] => {
  const effectiveCity = cityKey === 'default' ? 'bangalore' : cityKey;
  const meta = CITY_DIRECTORY[effectiveCity];
  const refLat = anchorCoords?.lat ?? meta.center.lat;
  const refLng = anchorCoords?.lng ?? meta.center.lng;

  return meta.landmarks.slice(0, 7).map((lm) => ({
    name: lm.name,
    subtitle: lm.subtitle,
    full: `${lm.name}, ${lm.subtitle}`,
    lat: lm.lat,
    lng: lm.lng,
    distanceKm: haversineDistanceKm(refLat, refLng, lm.lat, lm.lng),
    categoryIcon: lm.icon,
  }));
};

/**
 * Resolves a Quick Hub chip (`Airport`, `Railway Station`, `Metro Station`, `Tech Park`)
 * directly to the exact hub of the user's active city.
 */
export const getQuickHubForCity = (
  cityKey: CityKey,
  hubLabel: 'Airport' | 'Railway Station' | 'Metro Station' | 'Tech Park',
  anchorCoords?: { lat: number; lng: number }
): PlaceSuggestion => {
  const effectiveCity = cityKey === 'default' ? 'bangalore' : cityKey;
  const meta = CITY_DIRECTORY[effectiveCity];
  const hub = meta.quickHubs[hubLabel];
  const refLat = anchorCoords?.lat ?? meta.center.lat;
  const refLng = anchorCoords?.lng ?? meta.center.lng;
  return {
    ...hub,
    distanceKm: haversineDistanceKm(refLat, refLng, hub.lat, hub.lng),
  };
};

/**
 * Uber / Ola / Rapido-grade location autocomplete engine.
 * Strictly biases and bounds suggestions to the user's active city & pickup coordinates
 * so searching a destination in Bengaluru never suggests places in Himachal Pradesh or 2,000km away.
 */
export const searchPlacesAutocomplete = async (opts: {
  query: string;
  activeCity: CityKey;
  anchorCoords?: { lat: number; lng: number };
  signal?: AbortSignal;
}): Promise<PlaceSuggestion[]> => {
  const clean = opts.query.trim();
  if (clean.length < 2) return [];

  // Check if user explicitly typed a city name in the query itself
  const explicitQueryCity = normalizeCityName(clean);
  const targetCityKey: Exclude<CityKey, 'default'> =
    explicitQueryCity !== 'default'
      ? explicitQueryCity
      : opts.activeCity !== 'default'
        ? opts.activeCity
        : opts.anchorCoords
          ? (() => {
              const detected = detectCityFromCoords(
                opts.anchorCoords.lat,
                opts.anchorCoords.lng
              );
              return detected !== 'default' ? detected : 'bangalore';
            })()
          : 'bangalore';

  const cityMeta = CITY_DIRECTORY[targetCityKey];
  const anchor =
    explicitQueryCity !== 'default' && explicitQueryCity !== opts.activeCity
      ? cityMeta.center
      : opts.anchorCoords ?? cityMeta.center;

  const lowerQuery = clean.toLowerCase();
  const candidates: PlaceSuggestion[] = [];
  const seenKeys = new Set<string>();

  const pushCandidate = (item: PlaceSuggestion) => {
    const distFromAnchor = haversineDistanceKm(
      anchor.lat,
      anchor.lng,
      item.lat,
      item.lng
    );

    // Reject cross-state noise (> 90km away from anchor/city center)
    if (distFromAnchor > 90) {
      return;
    }

    const dedupeKey = `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '')}:${item.lat.toFixed(2)},${item.lng.toFixed(2)}`;
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);

    candidates.push({
      ...item,
      distanceKm: distFromAnchor,
    });
  };

  // 1. Instant Curated City Landmark & Neighborhood Matches (<1ms)
  for (const lm of cityMeta.landmarks) {
    const nameMatch = lm.name.toLowerCase().includes(lowerQuery);
    const subMatch = lm.subtitle.toLowerCase().includes(lowerQuery);
    const aliasMatch = lm.aliases?.some((a) => a.includes(lowerQuery));
    if (nameMatch || subMatch || aliasMatch) {
      pushCandidate({
        name: lm.name,
        subtitle: lm.subtitle,
        full: `${lm.name}, ${lm.subtitle}`,
        lat: lm.lat,
        lng: lm.lng,
        categoryIcon: lm.icon,
        isMajorHub: true,
      });
    }
  }

  // If query is only 2 chars, return instant local landmark matches immediately
  if (clean.length < 3 && candidates.length > 0) {
    return candidates.slice(0, 6);
  }

  // 2. Try Ola Maps Autocomplete with location bias if key is configured
  const olaApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;
  if (olaApiKey) {
    try {
      const olaUrl = `https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(
        clean
      )}&location=${anchor.lat},${anchor.lng}&radius=55000&strictbounds=true&api_key=${encodeURIComponent(
        olaApiKey
      )}`;
      const res = await fetch(olaUrl, { signal: opts.signal });
      if (res.ok) {
        const data = await res.json();
        const preds = data?.predictions;
        if (Array.isArray(preds)) {
          for (const p of preds) {
            if (!p?.geometry?.location) continue;
            const lat = Number(p.geometry.location.lat);
            const lng = Number(p.geometry.location.lng);
            const name =
              p.structured_formatting?.main_text ||
              p.description?.split(',')[0] ||
              clean;
            const full = p.description || clean;
            const subtitle =
              p.structured_formatting?.secondary_text ||
              full.split(',').slice(1, 4).join(',').trim() ||
              cityMeta.label;
            pushCandidate({
              name,
              subtitle,
              full,
              lat,
              lng,
              categoryIcon: inferCategoryIcon(full),
            });
          }
        }
      }
    } catch {}
  }

  // 3. Bounded City Search across Nominatim (viewbox + bounded=1) and Photon (bbox + lat/lon bias)
  const d = cityMeta.bboxDeltaDeg;
  const minLng = (anchor.lng - d).toFixed(4);
  const minLat = (anchor.lat - d).toFixed(4);
  const maxLng = (anchor.lng + d).toFixed(4);
  const maxLat = (anchor.lat + d).toFixed(4);

  // Photon uses bbox=minLon,minLat,maxLon,maxLat
  const photonBbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  // Nominatim uses viewbox=minLon,maxLat,maxLon,minLat + bounded=1
  const nomViewbox = `${minLng},${maxLat},${maxLng},${minLat}`;

  const queryHasCity = lowerQuery.includes(cityMeta.searchName.toLowerCase()) ||
    lowerQuery.includes(cityMeta.label.toLowerCase());
  const nomQuery = queryHasCity ? clean : `${clean}, ${cityMeta.searchName}`;

  try {
    const [nomRes, photonRes] = await Promise.allSettled([
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          nomQuery
        )}&countrycodes=in&viewbox=${nomViewbox}&bounded=1&format=json&addressdetails=1&limit=6`,
        {
          headers: {
            'User-Agent': 'FareSnap/1.0 (https://github.com/deveshkolte/FareSnap)',
          },
          signal: opts.signal,
        }
      ).then((r) => r.json()),
      fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(
          clean
        )}&lat=${anchor.lat}&lon=${anchor.lng}&bbox=${photonBbox}&limit=8&lang=en`,
        { signal: opts.signal }
      ).then((r) => r.json()),
    ]);

    if (nomRes.status === 'fulfilled' && Array.isArray(nomRes.value)) {
      for (const item of nomRes.value) {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const displayParts = String(item.display_name || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const name = item.name || displayParts[0] || clean;
        const subtitle =
          displayParts.slice(1, 4).join(', ') ||
          `${cityMeta.label}, ${cityMeta.stateName}`;
        const full = displayParts.slice(0, 4).join(', ') || name;

        pushCandidate({
          name,
          subtitle,
          full,
          lat,
          lng,
          categoryIcon: inferCategoryIcon(full, item.type),
        });
      }
    }

    if (
      photonRes.status === 'fulfilled' &&
      Array.isArray(photonRes.value?.features)
    ) {
      for (const f of photonRes.value.features) {
        const p = f.properties || {};
        const lat = Number(f.geometry?.coordinates?.[1]);
        const lng = Number(f.geometry?.coordinates?.[0]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const name = p.name || p.street || p.district || clean;
        const subParts = [
          p.street && p.street !== name ? p.street : null,
          p.district || p.locality || p.suburb,
          p.city || cityMeta.label,
        ].filter(Boolean);
        const subtitle =
          subParts.join(', ') || `${cityMeta.label}, ${cityMeta.stateName}`;
        const full = `${name}, ${subtitle}`;

        pushCandidate({
          name,
          subtitle,
          full,
          lat,
          lng,
          categoryIcon: inferCategoryIcon(full, p.osm_value),
        });
      }
    }
  } catch {}

  // Sort candidates by commuter relevance (Major City Hub > Exact/Word Prefix > Proximity to Pickup)
  const wordRegex = new RegExp(
    `\\b${lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'i'
  );
  candidates.sort((a, b) => {
    const aHub = a.isMajorHub ? 1 : 0;
    const bHub = b.isMajorHub ? 1 : 0;
    if (aHub !== bHub) return bHub - aHub;

    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();
    const aStarts = aLower.startsWith(lowerQuery) ? 1 : 0;
    const bStarts = bLower.startsWith(lowerQuery) ? 1 : 0;
    if (aStarts !== bStarts) return bStarts - aStarts;

    const aWord = wordRegex.test(a.name) ? 1 : 0;
    const bWord = wordRegex.test(b.name) ? 1 : 0;
    if (aWord !== bWord) return bWord - aWord;

    return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
  });

  return candidates.slice(0, 6);
};
