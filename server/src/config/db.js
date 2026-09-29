const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const {
  initialUsers,
  initialDrivers,
  initialRoutes,
  initialStops,
  initialShuttles,
  initialTrips,
  initialNotifications,
  initialSchedules
} = require('../database/mockData');

// Known real-world coordinate lookup for instant high-accuracy geocoding + Google/Nominatim fallback
const KNOWN_LOCATIONS = {
  'sri sairam engineering college': { lat: 12.9602, lng: 80.0569 },
  'sairam engineering college': { lat: 12.9602, lng: 80.0569 },
  'sairam college': { lat: 12.9602, lng: 80.0569 },
  'sairam polytechnic college': { lat: 12.9610, lng: 80.0575 },
  'sairam hostel': { lat: 12.9595, lng: 80.0560 },
  'sairam': { lat: 12.9602, lng: 80.0569 },
  'west tambaram': { lat: 12.9249, lng: 80.1000 },
  'tambaram west': { lat: 12.9249, lng: 80.1000 },
  'east tambaram': { lat: 12.9229, lng: 80.1275 },
  'tambaram east': { lat: 12.9229, lng: 80.1275 },
  'tambaram sanatorium': { lat: 12.9385, lng: 80.1268 },
  'tambaram railway station': { lat: 12.9259, lng: 80.1181 },
  'tambaram bus stand': { lat: 12.9249, lng: 80.1145 },
  'tambaram': { lat: 12.9249, lng: 80.1000 },
  'mcc': { lat: 12.9212, lng: 80.1228 },
  'madras christian college': { lat: 12.9212, lng: 80.1228 },
  'irumbuliyur': { lat: 12.9172, lng: 80.1072 },
  'peerkankaranai': { lat: 12.9098, lng: 80.0965 },
  'perungalathur': { lat: 12.9048, lng: 80.0889 },
  'old perungalathur': { lat: 12.9062, lng: 80.0815 },
  'new perungalathur': { lat: 12.9048, lng: 80.0889 },
  'vandalur': { lat: 12.8913, lng: 80.0810 },
  'vandalur zoo': { lat: 12.8792, lng: 80.0817 },
  'vandalur gate': { lat: 12.8913, lng: 80.0810 },
  'kilambakkam': { lat: 12.8778, lng: 80.0748 },
  'kilambakkam bus terminus': { lat: 12.8778, lng: 80.0748 },
  'kcbt': { lat: 12.8778, lng: 80.0748 },
  'urapakkam': { lat: 12.8674, lng: 80.0699 },
  'guduvancheri': { lat: 12.8439, lng: 80.0597 },
  'nandhivaram': { lat: 12.8415, lng: 80.0635 },
  'potheri': { lat: 12.8231, lng: 80.0428 },
  'kattankulathur': { lat: 12.8184, lng: 80.0384 },
  'maraimalai nagar': { lat: 12.7931, lng: 80.0252 },
  'singaperumal koil': { lat: 12.7606, lng: 80.0043 },
  'chengalpattu': { lat: 12.6819, lng: 79.9888 },
  'mudichur': { lat: 12.9102, lng: 80.0717 },
  'varadharajapuram': { lat: 12.9065, lng: 80.0575 },
  'mannivakkam': { lat: 12.8935, lng: 80.0628 },
  'padappai': { lat: 12.8837, lng: 80.0298 },
  'oragadam': { lat: 12.8333, lng: 79.9500 },
  'kishkinta': { lat: 12.9441, lng: 80.0686 },
  'dharkast': { lat: 12.9525, lng: 80.0695 },
  'manimangalam': { lat: 12.9206, lng: 80.0369 },
  'somangalam': { lat: 12.9685, lng: 80.0342 },
  'kundrathur': { lat: 12.9977, lng: 80.0972 },
  'mangadu': { lat: 13.0273, lng: 80.1107 },
  'kovur': { lat: 13.0110, lng: 80.1208 },
  'chromepet': { lat: 12.9516, lng: 80.1462 },
  'mit gate': { lat: 12.9489, lng: 80.1419 },
  'pallavaram': { lat: 12.9675, lng: 80.1491 },
  'pammal': { lat: 12.9749, lng: 80.1348 },
  'anakaputhur': { lat: 12.9825, lng: 80.1264 },
  'tirusulam': { lat: 12.9806, lng: 80.1656 },
  'meenambakkam': { lat: 12.9875, lng: 80.1753 },
  'chennai airport': { lat: 12.9941, lng: 80.1709 },
  'airport': { lat: 12.9941, lng: 80.1709 },
  'alandur': { lat: 13.0042, lng: 80.2015 },
  'st thomas mount': { lat: 13.0053, lng: 80.1931 },
  'kathipara': { lat: 13.0072, lng: 80.2045 },
  'ekkatuthangal': { lat: 13.0172, lng: 80.2058 },
  'guindy': { lat: 13.0067, lng: 80.2206 },
  'little mount': { lat: 13.0145, lng: 80.2242 },
  'saidapet': { lat: 13.0213, lng: 80.2231 },
  'nandanam': { lat: 13.0316, lng: 80.2398 },
  'teynampet': { lat: 13.0405, lng: 80.2503 },
  'dms': { lat: 13.0445, lng: 80.2479 },
  'thousand lights': { lat: 13.0587, lng: 80.2570 },
  'lic': { lat: 13.0645, lng: 80.2652 },
  'mount road': { lat: 13.0620, lng: 80.2610 },
  'velachery': { lat: 12.9815, lng: 80.2180 },
  'phoenix mall': { lat: 12.9915, lng: 80.2167 },
  'vijayanagar': { lat: 12.9788, lng: 80.2209 },
  'taramani': { lat: 12.9863, lng: 80.2432 },
  'tidel park': { lat: 12.9896, lng: 80.2486 },
  'srp tools': { lat: 12.9789, lng: 80.2498 },
  'thiruvanmiyur': { lat: 12.9830, lng: 80.2594 },
  'adyar': { lat: 13.0012, lng: 80.2565 },
  'madhya kailash': { lat: 13.0064, lng: 80.2475 },
  'iit madras': { lat: 12.9915, lng: 80.2337 },
  'kotturpuram': { lat: 13.0182, lng: 80.2412 },
  'besant nagar': { lat: 13.0003, lng: 80.2667 },
  'mandaveli': { lat: 13.0241, lng: 80.2642 },
  'mylapore': { lat: 13.0368, lng: 80.2676 },
  'santhome': { lat: 13.0319, lng: 80.2788 },
  'royapettah': { lat: 13.0540, lng: 80.2641 },
  'triplicane': { lat: 13.0588, lng: 80.2756 },
  'marina beach': { lat: 13.0500, lng: 80.2824 },
  't nagar': { lat: 13.0418, lng: 80.2341 },
  'panagal park': { lat: 13.0416, lng: 80.2337 },
  'pondicherry bazaar': { lat: 13.0398, lng: 80.2392 },
  'valluvar kottam': { lat: 13.0528, lng: 80.2417 },
  'nungambakkam': { lat: 13.0569, lng: 80.2425 },
  'kodambakkam': { lat: 13.0521, lng: 80.2255 },
  'chetpet': { lat: 13.0714, lng: 80.2417 },
  'west mambalam': { lat: 13.0384, lng: 80.2209 },
  'ashok nagar': { lat: 13.0373, lng: 80.2123 },
  'ashok pillar': { lat: 13.0348, lng: 80.2102 },
  'kk nagar': { lat: 13.0410, lng: 80.1994 },
  'nesapakkam': { lat: 13.0372, lng: 80.1912 },
  'vadapalani': { lat: 13.0500, lng: 80.2121 },
  'arumbakkam': { lat: 13.0622, lng: 80.2115 },
  'aminjikarai': { lat: 13.0698, lng: 80.2245 },
  'shenoy nagar': { lat: 13.0785, lng: 80.2285 },
  'koyambedu': { lat: 13.0694, lng: 80.1948 },
  'cmbt': { lat: 13.0674, lng: 80.2056 },
  'anna nagar': { lat: 13.0850, lng: 80.2101 },
  'anna nagar west': { lat: 13.0902, lng: 80.1972 },
  'anna nagar east': { lat: 13.0852, lng: 80.2212 },
  'kilpauk': { lat: 13.0784, lng: 80.2415 },
  'purasawalkam': { lat: 13.0872, lng: 80.2535 },
  'vepery': { lat: 13.0848, lng: 80.2625 },
  'egmore': { lat: 13.0732, lng: 80.2609 },
  'chintadripet': { lat: 13.0748, lng: 80.2712 },
  'chennai central': { lat: 13.0827, lng: 80.2707 },
  'central': { lat: 13.0827, lng: 80.2707 },
  'broadway': { lat: 13.0896, lng: 80.2852 },
  'parrys': { lat: 13.0896, lng: 80.2882 },
  'mannady': { lat: 13.0958, lng: 80.2892 },
  'washermanpet': { lat: 13.1145, lng: 80.2872 },
  'royapuram': { lat: 13.1137, lng: 80.2954 },
  'tondiarpet': { lat: 13.1265, lng: 80.2897 },
  'thiruvottiyur': { lat: 13.1622, lng: 80.3015 },
  'ennore': { lat: 13.2165, lng: 80.3202 },
  'vyasarpadi': { lat: 13.1185, lng: 80.2582 },
  'moolakadai': { lat: 13.1292, lng: 80.2415 },
  'madhavaram': { lat: 13.1482, lng: 80.2312 },
  'red hills': { lat: 13.1912, lng: 80.1842 },
  'redhills': { lat: 13.1912, lng: 80.1842 },
  'puzhal': { lat: 13.1585, lng: 80.2035 },
  'retteri': { lat: 13.1335, lng: 80.2145 },
  'perambur': { lat: 13.1072, lng: 80.2442 },
  'ayanavaram': { lat: 13.0985, lng: 80.2325 },
  'kolathur': { lat: 13.1240, lng: 80.2121 },
  'villivakkam': { lat: 13.1086, lng: 80.2061 },
  'korattur': { lat: 13.1082, lng: 80.1832 },
  'padi': { lat: 13.0968, lng: 80.1845 },
  'mogappair': { lat: 13.0837, lng: 80.1750 },
  'thirumangalam': { lat: 13.0835, lng: 80.1945 },
  'ambattur': { lat: 13.1143, lng: 80.1548 },
  'avadi': { lat: 13.1067, lng: 80.0970 },
  'pattabiram': { lat: 13.1168, lng: 80.0635 },
  'thiruninravur': { lat: 13.1195, lng: 80.0275 },
  'tiruvallur': { lat: 13.1432, lng: 79.9120 },
  'thiruvallur': { lat: 13.1432, lng: 79.9120 },
  'poonamallee': { lat: 13.0473, lng: 80.0945 },
  'nazarathpet': { lat: 13.0452, lng: 80.0725 },
  'thandalam': { lat: 13.0125, lng: 80.0250 },
  'karayanchavadi': { lat: 13.0492, lng: 80.1075 },
  'kumananchavadi': { lat: 13.0439, lng: 80.1211 },
  'iyyappanthangal': { lat: 13.0381, lng: 80.1354 },
  'porur': { lat: 13.0382, lng: 80.1565 },
  'dlf porur': { lat: 13.0245, lng: 80.1765 },
  'nandambakkam': { lat: 13.0145, lng: 80.1865 },
  'ramapuram': { lat: 13.0317, lng: 80.1817 },
  'valasaravakkam': { lat: 13.0403, lng: 80.1723 },
  'alwarthirunagar': { lat: 13.0428, lng: 80.1815 },
  'virugambakkam': { lat: 13.0532, lng: 80.1922 },
  'nerkundram': { lat: 13.0685, lng: 80.1795 },
  'maduravoyal': { lat: 13.0654, lng: 80.1674 },
  'vanagaram': { lat: 13.0569, lng: 80.1462 },
  'sriperumbudur': { lat: 12.9674, lng: 79.9419 },
  'kanchipuram': { lat: 12.8342, lng: 79.7036 },
  'selaiyur': { lat: 12.9185, lng: 80.1432 },
  'camp road': { lat: 12.9195, lng: 80.1370 },
  'rajkilpakkam': { lat: 12.9165, lng: 80.1512 },
  'mahalakshmi nagar': { lat: 12.9192, lng: 80.1310 },
  'sembakkam': { lat: 12.9226, lng: 80.1572 },
  'gowrivakkam': { lat: 12.9212, lng: 80.1684 },
  'medavakkam': { lat: 12.9171, lng: 80.1923 },
  'sithalapakkam': { lat: 12.8895, lng: 80.1895 },
  'pallikaranai': { lat: 12.9349, lng: 80.2137 },
  'madipakkam': { lat: 12.9623, lng: 80.1986 },
  'keelkattalai': { lat: 12.9557, lng: 80.1869 },
  'kovilambakkam': { lat: 12.9442, lng: 80.1851 },
  'eachangadu': { lat: 12.9482, lng: 80.1735 },
  'nanganallur': { lat: 12.9807, lng: 80.1882 },
  'pazhavanthangal': { lat: 12.9895, lng: 80.1865 },
  'perumbakkam': { lat: 12.9059, lng: 80.1999 },
  'sholinganallur': { lat: 12.9010, lng: 80.2279 },
  'karapakkam': { lat: 12.9192, lng: 80.2300 },
  'thoraipakkam': { lat: 12.9416, lng: 80.2362 },
  'perungudi': { lat: 12.9654, lng: 80.2461 },
  'kandanchavadi': { lat: 12.9712, lng: 80.2485 },
  'omr': { lat: 12.9165, lng: 80.2298 },
  'navalur': { lat: 12.8459, lng: 80.2265 },
  'siruseri': { lat: 12.8256, lng: 80.2205 },
  'padur': { lat: 12.8085, lng: 80.2225 },
  'kelambakkam': { lat: 12.7879, lng: 80.2202 },
  'thiruporur': { lat: 12.7239, lng: 80.1884 },
  'ecr': { lat: 12.9005, lng: 80.2512 },
  'palavakkam': { lat: 12.9615, lng: 80.2585 },
  'neelankarai': { lat: 12.9492, lng: 80.2565 },
  'injambakkam': { lat: 12.9195, lng: 80.2512 },
  'akkarai': { lat: 12.8995, lng: 80.2495 },
  'kovalam': { lat: 12.7895, lng: 80.2515 },
  'mahabalipuram': { lat: 12.6208, lng: 80.1945 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'coimbatore': { lat: 11.0168, lng: 76.9558 },
  'madurai': { lat: 9.9252, lng: 78.1198 },
  'trichy': { lat: 10.7905, lng: 78.7047 },
  'salem': { lat: 11.6643, lng: 78.1460 },
  'anna university': { lat: 13.0109, lng: 80.2354 },
  'srm university': { lat: 12.8230, lng: 80.0444 },
  'srm institute of science and technology': { lat: 12.8230, lng: 80.0444 },
  'vit chennai': { lat: 12.8406, lng: 80.1534 },
  'sathyabama university': { lat: 12.8729, lng: 80.2261 },
  'sathyabama institute of science and technology': { lat: 12.8729, lng: 80.2261 },
  'sathyabama': { lat: 12.8729, lng: 80.2261 },
  'rajalakshmi engineering college': { lat: 13.0085, lng: 80.0034 },
  'panimalar engineering college': { lat: 13.0498, lng: 80.0752 },
  'saveetha engineering college': { lat: 13.0262, lng: 80.0160 },
  'crescent university': { lat: 12.8755, lng: 80.0835 },
  'tagore engineering college': { lat: 12.8635, lng: 80.1395 },
  'loyola college': { lat: 13.0625, lng: 80.2337 },
  'erumaiyur': { lat: 12.9545, lng: 80.0665 },
  'erumaiyur bus stop': { lat: 12.9545, lng: 80.0665 },
  'kishkinta theme park': { lat: 12.9441, lng: 80.0686 },
  'darkas': { lat: 12.9525, lng: 80.0695 },
  'dharkas': { lat: 12.9525, lng: 80.0695 },
  'sai leo nagar': { lat: 12.9602, lng: 80.0569 },
  'poonthandalam': { lat: 12.9635, lng: 80.0525 },
  'palanthandalam': { lat: 12.9652, lng: 80.0785 },
  'naduveerapattu': { lat: 12.9415, lng: 80.0385 },
  'thirumudivakkam': { lat: 12.9683, lng: 80.0961 },
  'tirumudivakkam': { lat: 12.9683, lng: 80.0961 },
  'thiruneermalai': { lat: 12.9625, lng: 80.1145 },
  'tiruneermalai': { lat: 12.9625, lng: 80.1145 },
  'guduvanchery': { lat: 12.8439, lng: 80.0597 },
  'kolapakkam': { lat: 12.8782, lng: 80.1152 },
  'vengambakkam': { lat: 12.8852, lng: 80.1435 },
  'agaramthen': { lat: 12.8758, lng: 80.1485 },
  'rathinamangalam': { lat: 12.8595, lng: 80.1512 },
  'kandigai': { lat: 12.8458, lng: 80.1552 },
  'mambakkam': { lat: 12.8325, lng: 80.1685 },
  'pudupakkam': { lat: 12.8115, lng: 80.1955 },
  'polachery': { lat: 12.8215, lng: 80.1815 },
  'semmancheri': { lat: 12.8665, lng: 80.2245 },
  'thaiyur': { lat: 12.7712, lng: 80.2125 },
  'ottiyambakkam': { lat: 12.8765, lng: 80.1985 },
  'walajabad': { lat: 12.7912, lng: 79.8215 },
  'sunguvarchatram': { lat: 12.9365, lng: 79.8655 },
  'mudichur road': { lat: 12.9188, lng: 80.0865 },
  'shanmugam road': { lat: 12.9268, lng: 80.1125 },
  'gandhi road': { lat: 12.9255, lng: 80.1088 },
  'gst road': { lat: 12.9320, lng: 80.1215 },
  'velachery main road': { lat: 12.9210, lng: 80.1490 },
  'outer ring road': { lat: 12.9360, lng: 80.0640 },
  'lakshmi nagar': { lat: 12.9145, lng: 80.0785 },
  'bharathi nagar': { lat: 12.9390, lng: 80.0730 },
  'hostel complex': { lat: 12.9595, lng: 80.0560 },
  'main gate': { lat: 12.9612, lng: 80.0582 },
  'academic block': { lat: 12.9605, lng: 80.0572 },
  'library': { lat: 12.9600, lng: 80.0566 },
  'sports ground': { lat: 12.9588, lng: 80.0552 },
  'sports arena': { lat: 12.9588, lng: 80.0552 },
  'gate 2 terminal': { lat: 12.9618, lng: 80.0590 },
  'engineering hall': { lat: 12.9603, lng: 80.0570 },
  'science complex': { lat: 12.9598, lng: 80.0564 },
  'student dining hall': { lat: 12.9592, lng: 80.0558 },
  'metro station link': { lat: 12.9941, lng: 80.1709 }
};

// Helper to calculate distance in kilometers between two geo coordinates
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0.05, Number((R * c).toFixed(2)));
}

async function geocodeLocation(placeName, fallbackLat = 12.9602, fallbackLng = 80.0569, routeCorridor = null) {
  if (!placeName || typeof placeName !== 'string') {
    return { lat: fallbackLat, lng: fallbackLng, isFallback: true };
  }
  const clean = placeName.trim().toLowerCase().replace(/\s+/g, ' ');
  const primaryPart = clean.split(',')[0].trim();

  const hasCorridor =
    routeCorridor &&
    Number.isFinite(Number(routeCorridor.startLat)) &&
    Number.isFinite(Number(routeCorridor.startLng)) &&
    Number.isFinite(Number(routeCorridor.endLat)) &&
    Number.isFinite(Number(routeCorridor.endLng));

  const refLat = Number(
    hasCorridor
      ? (Number(routeCorridor.startLat) + Number(routeCorridor.endLat)) / 2
      : fallbackLat || 12.9602
  );
  const refLng = Number(
    hasCorridor
      ? (Number(routeCorridor.startLng) + Number(routeCorridor.endLng)) / 2
      : fallbackLng || 80.0569
  );

  // Regional sanity check (200 km around the route region) so real stops anywhere in the city/district are NEVER rejected
  const isWithinRegion = (lat, lng) => {
    if (!hasCorridor) return true;
    const distFromCenter = calculateDistanceKm(refLat, refLng, lat, lng);
    return distFromCenter <= 200;
  };

  // 1. Check exact match in KNOWN_LOCATIONS by primary stop name first, then full string
  if (
    primaryPart &&
    KNOWN_LOCATIONS[primaryPart] &&
    isWithinRegion(KNOWN_LOCATIONS[primaryPart].lat, KNOWN_LOCATIONS[primaryPart].lng)
  ) {
    return { ...KNOWN_LOCATIONS[primaryPart] };
  }
  if (KNOWN_LOCATIONS[clean] && isWithinRegion(KNOWN_LOCATIONS[clean].lat, KNOWN_LOCATIONS[clean].lng)) {
    return { ...KNOWN_LOCATIONS[clean] };
  }

  // 2. Check specific whole-word match in KNOWN_LOCATIONS on primaryPart ONLY (excluding broad/generic words)
  const excludedSubstringKeys = new Set([
    'chennai',
    'coimbatore',
    'madurai',
    'trichy',
    'salem',
    'main gate',
    'academic block',
    'library',
    'sports ground',
    'sports arena',
    'gate 2 terminal',
    'engineering hall',
    'science complex',
    'student dining hall',
    'metro station link',
    'hostel complex',
    'lakshmi nagar',
    'bharathi nagar',
    'gandhi road',
    'shanmugam road',
    'gst road',
    'outer ring road'
  ]);
  const sortedEntries = Object.entries(KNOWN_LOCATIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [key, coords] of sortedEntries) {
    if (key.length >= 4 && !excludedSubstringKeys.has(key)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordRegex = new RegExp(`\\b${escapedKey}\\b`, 'i');
      if (wordRegex.test(primaryPart) && isWithinRegion(coords.lat, coords.lng)) {
        return { ...coords };
      }
    }
  }

  const rawPrimary = placeName.split(',')[0].trim();

  // 3. Live ArcGIS World Geocoder (works reliably on Render and local without IP rate-limiting)
  const arcgisQueries = [
    `${rawPrimary}, Tamil Nadu, India`,
    `${placeName.trim()}, Tamil Nadu, India`
  ];
  for (const qText of arcgisQueries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=5&countryCode=IND&location=${refLng.toFixed(4)},${refLat.toFixed(4)}&distance=90000&singleLine=${encodeURIComponent(qText)}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.candidates) && data.candidates.length > 0) {
          for (const cand of data.candidates) {
            const loc = cand?.location;
            if (!loc || (cand.score !== undefined && Number(cand.score) < 70)) continue;
            const lat = Number(parseFloat(loc.y).toFixed(5));
            const lng = Number(parseFloat(loc.x).toFixed(5));
            if (!isNaN(lat) && !isNaN(lng) && isWithinRegion(lat, lng)) {
              const resolved = { lat, lng };
              KNOWN_LOCATIONS[primaryPart || clean] = resolved;
              return { ...resolved };
            }
          }
        }
      }
    } catch (_) {}
  }

  // 4. Live Photon OSM Geocoder (Komoot) — fast & cloud-friendly
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(rawPrimary + ', Tamil Nadu')}&lat=${refLat.toFixed(4)}&lon=${refLng.toFixed(4)}&limit=5`;
    const res = await fetch(photonUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.features) && data.features.length > 0) {
        for (const feat of data.features) {
          const coords = feat?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            const lng = Number(parseFloat(coords[0]).toFixed(5));
            const lat = Number(parseFloat(coords[1]).toFixed(5));
            if (!isNaN(lat) && !isNaN(lng) && isWithinRegion(lat, lng)) {
              const resolved = { lat, lng };
              KNOWN_LOCATIONS[primaryPart || clean] = resolved;
              return { ...resolved };
            }
          }
        }
      }
    }
  } catch (_) {}

  // 5. Live OpenStreetMap Nominatim Geocoding (Tamil Nadu search first so Chengalpattu/Kanchipuram suburbs resolve)
  const nominatimQueries = [
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(rawPrimary + ', Tamil Nadu, India')}`,
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(rawPrimary + ', Chennai, Tamil Nadu')}`
  ];

  for (const url of nominatimQueries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ShuttleTrackerEnterprise/1.0' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          for (const item of data) {
            const lat = Number(parseFloat(item.lat).toFixed(5));
            const lng = Number(parseFloat(item.lon).toFixed(5));
            if (!isNaN(lat) && !isNaN(lng) && isWithinRegion(lat, lng)) {
              const resolved = { lat, lng };
              KNOWN_LOCATIONS[primaryPart || clean] = resolved;
              return { ...resolved };
            }
          }
        }
      }
    } catch (_) {}
  }

  // 6. Fallback if stop name is a custom campus building / gate not in external gazetteers
  if (hasCorridor) {
    const sLat = Number(routeCorridor.startLat);
    const sLng = Number(routeCorridor.startLng);
    const eLat = Number(routeCorridor.endLat);
    const eLng = Number(routeCorridor.endLng);
    const frac = Math.min(0.88, Math.max(0.15, Number(routeCorridor.fraction) || 0.5));
    return {
      lat: Number((sLat + (eLat - sLat) * frac).toFixed(5)),
      lng: Number((sLng + (eLng - sLng) * frac).toFixed(5)),
      isFallback: true
    };
  }

  return { lat: fallbackLat, lng: fallbackLng, isFallback: true };
}

function parseTimeStrToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const clean = timeStr.trim().toUpperCase();
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    const period = match12[3];
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + mins;
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    return hours * 60 + mins;
  }
  return null;
}

function isTimeWithinScheduleWindow(departureStr, arrivalStr) {
  const depMins = parseTimeStrToMinutes(departureStr);
  if (depMins === null) return false;
  let arrMins = parseTimeStrToMinutes(arrivalStr);
  if (arrMins === null) arrMins = (depMins + 25) % 1440;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (arrMins >= depMins) {
    return nowMins >= depMins && nowMins <= arrMins;
  }
  // Overnight wrap
  return nowMins >= depMins || nowMins <= arrMins;
}

function getMinutesUntilDeparture(departureStr) {
  const depMins = parseTimeStrToMinutes(departureStr);
  if (depMins === null) return null;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  let diff = depMins - nowMins;
  if (diff < -720) diff += 1440;
  return diff;
}

function getMinutesPastScheduledArrival(departureStr, arrivalStr) {
  const depMins = parseTimeStrToMinutes(departureStr);
  if (depMins === null) return 0;
  let arrMins = parseTimeStrToMinutes(arrivalStr);
  if (arrMins === null) arrMins = (depMins + 20) % 1440;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  // Consider within 180 minutes after scheduled arrival as the current trip window
  let past = nowMins - arrMins;
  if (past < -720) past += 1440;
  if (past > 0 && past <= 180) {
    return past;
  }
  return 0;
}

function cleanUploadedLicenseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (
    url.includes('OFFICIAL COMMERCIAL DRIVER LICENSE') ||
    url.startsWith('data:image/svg+xml;utf8,%3Csvg')
  ) {
    return '';
  }
  return url;
}

function formatDateAndMonth(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '26 September 2026';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function createDefaultPassengerIdCardSvg(u) {
  const name = String(u?.name || 'Student Passenger').replace(/[<>&"']/g, '');
  const pId = u?.passenger_code || `PSG-${100 + Number(u?.id || 1)}`;
  const bus = String(u?.bus_number || 'S01').replace(/[<>&"']/g, '');
  const org = String(u?.organization_name || 'Sairam Engineering College').replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="260" viewBox="0 0 460 260">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e3a8a"/>
      </linearGradient>
    </defs>
    <rect width="460" height="260" rx="18" fill="url(#bg)" stroke="#3b82f6" stroke-width="3"/>
    <rect x="0" y="0" width="460" height="54" rx="18" fill="#1d4ed8"/>
    <text x="24" y="28" fill="#ffffff" font-family="Arial, sans-serif" font-size="13" font-weight="bold">${org.toUpperCase()}</text>
    <text x="24" y="44" fill="#93c5fd" font-family="Arial, sans-serif" font-size="10" font-weight="bold">OFFICIAL STUDENT PASSENGER ID CARD</text>
    <rect x="336" y="14" width="100" height="26" rx="8" fill="#10b981"/>
    <text x="386" y="31" text-anchor="middle" fill="#ffffff" font-family="monospace" font-size="12" font-weight="bold">${pId}</text>
    <rect x="24" y="76" width="94" height="110" rx="12" fill="#1e293b" stroke="#60a5fa" stroke-width="2"/>
    <circle cx="71" cy="116" r="22" fill="#3b82f6"/>
    <path d="M41 168 C41 146 101 146 101 168 Z" fill="#3b82f6"/>
    <text x="138" y="96" fill="#94a3b8" font-family="Arial, sans-serif" font-size="10" font-weight="bold">PASSENGER NAME</text>
    <text x="138" y="116" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="bold">${name}</text>
    <text x="138" y="146" fill="#94a3b8" font-family="Arial, sans-serif" font-size="10" font-weight="bold">PASSENGER ID</text>
    <text x="138" y="166" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold">${pId}</text>
    <text x="290" y="146" fill="#94a3b8" font-family="Arial, sans-serif" font-size="10" font-weight="bold">ASSIGNED BUS</text>
    <text x="290" y="166" fill="#34d399" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Bus ${bus}</text>
    <rect x="24" y="206" width="412" height="32" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1"/>
    <text x="38" y="226" fill="#cbd5e1" font-family="monospace" font-size="11">VERIFIED CAMPUS SHUTTLE PASSENGER • ${pId}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function formatPassengerRecord(u, fallbackBusCode = 'S01') {
  const { password_hash, ...rest } = u || {};
  const seededMatch = initialUsers.find(
    (iu) => iu.email && u?.email && iu.email.toLowerCase() === u.email.toLowerCase()
  );
  const passengerCode = u?.passenger_code || `PSG-${100 + Number(u?.id || 1)}`;
  const busNumber = u?.bus_number || fallbackBusCode || 'S01';
  const avatarUrl =
    u?.avatar_url ||
    seededMatch?.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u?.name || 'Passenger')}`;
  const idCardUrl =
    u?.id_card_url ||
    createDefaultPassengerIdCardSvg({
      ...u,
      passenger_code: passengerCode,
      bus_number: busNumber
    });

  return {
    ...rest,
    id: u?.id,
    passenger_code: passengerCode,
    name: u?.name || 'Passenger',
    email: u?.email || '',
    phone: u?.phone || seededMatch?.phone || '',
    bus_number: busNumber,
    destination: u?.destination || seededMatch?.destination || 'Sports Ground',
    organization_name: u?.organization_name || 'Sairam Engineering College',
    avatar_url: avatarUrl,
    id_card_url: idCardUrl
  };
}

function normalizeOrgKey(orgName) {
  return String(orgName || 'Sairam Engineering College')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function matchesOrg(recordOrg, targetOrg) {
  if (!targetOrg) return true;
  const targetKey = normalizeOrgKey(targetOrg);
  const recKey = normalizeOrgKey(recordOrg || store.settings?.organization_name || 'Sairam Engineering College');
  return recKey === targetKey || recKey.includes(targetKey) || targetKey.includes(recKey);
}

// In-memory data store as resilient high-performance layer / PostgreSQL sync
const store = {
  users: initialUsers.map((u) => ({
    ...u,
    passenger_code: u.role === 'user' ? `PSG-${100 + Number(u.id)}` : undefined,
    plain_password: u.plain_password || (u.role === 'driver' ? 'driver123' : 'password123'),
    is_active: u.is_active !== false,
    organization_name: u.organization_name || 'Sairam Engineering College',
    bus_number: u.bus_number || (u.role === 'user' ? 'S01' : null),
    destination: u.destination || (u.role === 'user' ? 'Sports Ground' : null),
    id_card_url: u.id_card_url || ''
  })),
  drivers: initialDrivers.map((d, idx) => ({
    ...d,
    driver_code: d.driver_code || `DRV-${101 + idx}`,
    plain_password: d.plain_password || 'driver123',
    is_active: d.is_active !== false,
    organization_name: d.organization_name || 'Sairam Engineering College',
    driver_points: Number(d.driver_points) || 0,
    monthly_points: Number(d.monthly_points) || 0,
    yearly_points: Number(d.yearly_points) || 0,
    total_trips: Number(d.total_trips) || 0,
    avatar_url:
      d.avatar_url ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(d.name || 'Driver')}`,
    license_photo_url: cleanUploadedLicenseUrl(d.license_photo_url)
  })),
  routes: initialRoutes.map((r, idx) => ({
    ...r,
    shuttle_id: r.shuttle_id || idx + 1,
    organization_name: r.organization_name || 'Sairam Engineering College',
    landmark: r.landmark || 'Campus Main Transit Corridor'
  })),
  stops: [...initialStops],
  shuttles: initialShuttles.map((s) => {
    const r = initialRoutes.find((rt) => rt.id === s.current_route_id);
    return {
      ...s,
      organization_name: s.organization_name || 'Sairam Engineering College',
      start_point: s.start_point || (r ? r.start_point : 'Hostel Complex'),
      destination: s.destination || (r ? r.end_point : 'Sports Ground')
    };
  }),
  trips: [...initialTrips],
  notifications: [...initialNotifications],
  schedules: [...initialSchedules],
  driver_feedbacks: [],
  location_updates: [],
  org_settings: {},
  settings: {
    organization_name: 'Sairam Engineering College',
    speed_limit: 35,
    delay_threshold: 5,
    google_maps_key: process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyB2GCqJ6Je3N04Mie2Ga3SsF39xXws0vZQ',
    sample_id_card_url: '',
    sample_id_ocr_text: '',
    sample_id_format_keywords: [],
    admin_profile_name: 'System Administrator',
    admin_profile_email: 'cleancodeuniverse@gmail.com'
  }
};

function computeDriverFeedbackStats(driverId, fallbackRating = 5.0) {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  const sorted = store.driver_feedbacks
    .filter((f) => {
      if (Number(f.driver_id) !== Number(driverId)) return false;
      const createdTime = f.created_at ? new Date(f.created_at).getTime() : nowMs;
      return isNaN(createdTime) || nowMs - createdTime <= thirtyDaysMs;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((f) => {
      const linkedPassenger = f.passenger_id
        ? store.users.find((u) => Number(u.id) === Number(f.passenger_id))
        : null;
      return {
        ...f,
        passenger_name: linkedPassenger?.name || f.passenger_name || 'Passenger',
        passenger_avatar: linkedPassenger?.avatar_url || f.passenger_avatar || '',
        rating: Number(f.rating) || 5,
        formatted_date: f.formatted_date || formatDateAndMonth(f.created_at),
        performance_type:
          f.performance_type || (Number(f.rating) >= 4 ? 'Good Performance' : 'Bad Performance')
      };
    });

  // Keep only 1 feedback per passenger per 30-day window
  const seenPassengers = new Set();
  const feedbacks = [];
  for (const item of sorted) {
    const key = item.passenger_id
      ? `id_${item.passenger_id}`
      : `name_${String(item.passenger_name || '').trim().toLowerCase()}`;
    if (!seenPassengers.has(key)) {
      seenPassengers.add(key);
      feedbacks.push(item);
    }
  }

  if (feedbacks.length === 0) {
    return {
      rating: Number(fallbackRating) || 5.0,
      feedbackCount: 0,
      feedbacks: []
    };
  }
  const sum = feedbacks.reduce((acc, item) => acc + (Number(item.rating) || 5), 0);
  const avg = Number((sum / feedbacks.length).toFixed(2));
  return {
    rating: avg,
    feedbackCount: feedbacks.length,
    feedbacks
  };
}

function resolveDriverForShuttle(shuttle) {
  if (!shuttle) return null;
  const isRealEmail = (em) =>
    Boolean(
      em &&
        String(em).includes('@') &&
        !String(em).toLowerCase().endsWith('@shuttletrack.com') &&
        !String(em).toLowerCase().endsWith('@shuttletracker.com')
    );

  // 1. Direct match by assigned_shuttle_id or current_driver_id (prefer real email)
  const directMatches = store.drivers.filter(
    (d) =>
      Number(d.assigned_shuttle_id) === Number(shuttle.id) ||
      (shuttle.current_driver_id && Number(d.user_id) === Number(shuttle.current_driver_id))
  );
  let drv =
    directMatches.find((d) => {
      const u = store.users.find((usr) => usr.id === d.user_id);
      return isRealEmail(u?.email || d.email);
    }) || directMatches[0];

  // 2. Fallback: match by organization_name (prefer real email)
  if (!drv && shuttle.organization_name) {
    const orgDrivers = store.drivers.filter((d) => matchesOrg(d.organization_name, shuttle.organization_name));
    drv =
      orgDrivers.find((d) => {
        const u = store.users.find((usr) => usr.id === d.user_id);
        return isRealEmail(u?.email || d.email);
      }) || orgDrivers[0];
  }

  // 3. Fallback: any driver with a real email or single driver
  if (!drv) {
    drv =
      store.drivers.find((d) => {
        const u = store.users.find((usr) => usr.id === d.user_id);
        return isRealEmail(u?.email || d.email);
      }) ||
      (store.drivers.length === 1 ? store.drivers[0] : null);
  }
  return drv || null;
}

function resolveRouteForShuttle(shuttle) {
  if (!shuttle) return null;
  let rt = store.routes.find(
    (r) =>
      (shuttle.current_route_id && Number(r.id) === Number(shuttle.current_route_id)) ||
      Number(r.shuttle_id) === Number(shuttle.id)
  );
  if (!rt && shuttle.start_point && shuttle.destination) {
    rt = store.routes.find(
      (r) =>
        String(r.start_point || '').trim().toLowerCase() === String(shuttle.start_point || '').trim().toLowerCase() &&
        String(r.end_point || '').trim().toLowerCase() === String(shuttle.destination || '').trim().toLowerCase()
    );
  }
  return rt || null;
}

function getShuttleScheduleContext(shuttleId) {
  const schedulesForShuttle = store.schedules.filter(
    (sc) => Number(sc.shuttle_id) === Number(shuttleId)
  );
  if (schedulesForShuttle.length === 0) {
    return {
      hasSchedule: false,
      isScheduledTimeNow: false,
      activeSchedule: null
    };
  }
  const matchingNow = schedulesForShuttle.find((sc) =>
    isTimeWithinScheduleWindow(sc.departure_time, sc.arrival_time)
  );
  const primarySchedule = matchingNow || schedulesForShuttle[0];
  return {
    hasSchedule: true,
    isScheduledTimeNow: Boolean(matchingNow),
    activeSchedule: primarySchedule
  };
}

let pool = null;
let isPostgresConnected = false;

// Attempt PostgreSQL connection if configured
if (process.env.DATABASE_URL || (process.env.PGDATABASE && process.env.PGUSER)) {
  try {
    const isRemoteCloud =
      process.env.DATABASE_URL &&
      !process.env.DATABASE_URL.includes('localhost') &&
      !process.env.DATABASE_URL.includes('127.0.0.1');

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      user: process.env.PGUSER,
      host: process.env.PGHOST || 'localhost',
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT || 5432,
      ssl: isRemoteCloud || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    pool.connect(async (err, client, release) => {
      if (err) {
        console.warn('⚠️  PostgreSQL connection unavailable. Operating in Embedded Fallback mode with seeded data.');
        isPostgresConnected = false;
      } else {
        try {
          // 0. Ensure core tables exist on fresh cloud PostgreSQL databases (e.g. Render Postgres)
          await client.query(`
            CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              name VARCHAR(150) NOT NULL,
              email VARCHAR(150) UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              plain_password TEXT DEFAULT '',
              role VARCHAR(30) DEFAULT 'user',
              phone VARCHAR(40) DEFAULT '',
              organization_name TEXT DEFAULT 'Sairam Engineering College',
              bus_number VARCHAR(50) DEFAULT '',
              destination TEXT DEFAULT '',
              id_card_url TEXT DEFAULT '',
              avatar_url TEXT DEFAULT '',
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS routes (
              id SERIAL PRIMARY KEY,
              name VARCHAR(150) NOT NULL,
              code VARCHAR(50) DEFAULT '',
              start_point TEXT DEFAULT '',
              end_point TEXT DEFAULT '',
              landmark TEXT DEFAULT '',
              distance_km NUMERIC(6,2) DEFAULT 3.2,
              estimated_time_minutes INT DEFAULT 12,
              shuttle_id INT,
              organization_name TEXT DEFAULT 'Sairam Engineering College',
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS stops (
              id SERIAL PRIMARY KEY,
              route_id INT,
              name VARCHAR(150) NOT NULL,
              landmark TEXT DEFAULT '',
              latitude NUMERIC(10,6) NOT NULL,
              longitude NUMERIC(10,6) NOT NULL,
              sequence_order INT DEFAULT 1,
              stop_order INT DEFAULT 1,
              eta_minutesFromStart INT DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS shuttles (
              id SERIAL PRIMARY KEY,
              name VARCHAR(150) NOT NULL,
              code VARCHAR(50) NOT NULL,
              vehicle_number VARCHAR(60) DEFAULT '',
              capacity INT DEFAULT 40,
              status VARCHAR(40) DEFAULT 'idle',
              current_route_id INT,
              current_driver_id INT,
              start_point TEXT DEFAULT '',
              destination TEXT DEFAULT '',
              current_lat NUMERIC(10,6) DEFAULT 12.9602,
              current_lng NUMERIC(10,6) DEFAULT 80.0569,
              speed NUMERIC(6,2) DEFAULT 0,
              heading NUMERIC(6,2) DEFAULT 0,
              eta_minutes INT DEFAULT 5,
              next_stop_name TEXT DEFAULT '',
              passengers_count INT DEFAULT 0,
              organization_name TEXT DEFAULT 'Sairam Engineering College',
              last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS drivers (
              id SERIAL PRIMARY KEY,
              user_id INT,
              name VARCHAR(150) NOT NULL,
              email VARCHAR(150) DEFAULT '',
              phone VARCHAR(40) DEFAULT '',
              license_number VARCHAR(80) DEFAULT '',
              license_photo_url TEXT DEFAULT '',
              avatar_url TEXT DEFAULT '',
              plain_password TEXT DEFAULT '',
              status VARCHAR(40) DEFAULT 'available',
              is_active BOOLEAN DEFAULT TRUE,
              has_logged_in BOOLEAN DEFAULT FALSE,
              assigned_shuttle_id INT,
              rating NUMERIC(3,2) DEFAULT 5.0,
              total_trips INT DEFAULT 0,
              driver_points INT DEFAULT 0,
              monthly_points INT DEFAULT 0,
              yearly_points INT DEFAULT 0,
              organization_name TEXT DEFAULT 'Sairam Engineering College',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS trips (
              id SERIAL PRIMARY KEY,
              shuttle_id INT,
              driver_id INT,
              route_id INT,
              status VARCHAR(40) DEFAULT 'ongoing',
              delay_minutes INT DEFAULT 0,
              delay_reason TEXT DEFAULT '',
              started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              ended_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS schedules (
              id SERIAL PRIMARY KEY,
              route_id INT,
              route_name TEXT DEFAULT '',
              shuttle_id INT,
              departure_time VARCHAR(40) NOT NULL,
              arrival_time VARCHAR(40) NOT NULL,
              frequency_minutes INT DEFAULT 15,
              status VARCHAR(40) DEFAULT 'Scheduled',
              driver_points INT DEFAULT 0,
              monthly_points INT DEFAULT 0,
              yearly_points INT DEFAULT 0,
              total_trips INT DEFAULT 0,
              last_points_earned INT DEFAULT 0,
              organization_name TEXT DEFAULT 'Sairam Engineering College',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notifications (
              id SERIAL PRIMARY KEY,
              title TEXT NOT NULL,
              message TEXT NOT NULL,
              type VARCHAR(40) DEFAULT 'info',
              target_role VARCHAR(30) DEFAULT 'all',
              shuttle_id INT,
              organization_name TEXT DEFAULT 'Sairam Engineering College',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Ensure Admin account (cleancodeuniverse@gmail.com / Vetrivel@02) exists without altering any existing database data
          const defaultHash = await bcrypt.hash('Vetrivel@02', 10);
          await client.query(
            `INSERT INTO users (name, email, password_hash, plain_password, role, organization_name, is_active)
             VALUES ($1, $2, $3, $4, 'admin', $5, TRUE)
             ON CONFLICT (email) DO UPDATE
               SET password_hash = EXCLUDED.password_hash,
                   plain_password = EXCLUDED.plain_password,
                   role = 'admin',
                   is_active = TRUE`,
            ['System Administrator', 'cleancodeuniverse@gmail.com', defaultHash, 'Vetrivel@02', 'Sairam Engineering College']
          );
          await client.query(
            `UPDATE users
             SET password_hash = $1, plain_password = 'Vetrivel@02'
             WHERE role = 'admin'`,
            [defaultHash]
          );

          // 1. Automatically migrate new columns for Multi-Organization isolation, Passenger ID verification, Driver Points, & Shuttle Start/Destination
          await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name TEXT DEFAULT 'Sairam Engineering College';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS bus_number VARCHAR(50) DEFAULT '';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS destination TEXT DEFAULT '';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_url TEXT DEFAULT '';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT DEFAULT '';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS organization_name TEXT DEFAULT 'Sairam Engineering College';
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_photo_url TEXT DEFAULT '';
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS plain_password TEXT DEFAULT '';
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS has_logged_in BOOLEAN DEFAULT FALSE;
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS assigned_shuttle_id INT;
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS total_trips INT DEFAULT 0;
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS driver_points INT DEFAULT 0;
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS monthly_points INT DEFAULT 0;
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS yearly_points INT DEFAULT 0;

            ALTER TABLE shuttles ADD COLUMN IF NOT EXISTS organization_name TEXT DEFAULT 'Sairam Engineering College';
            ALTER TABLE shuttles ADD COLUMN IF NOT EXISTS start_point TEXT DEFAULT '';
            ALTER TABLE shuttles ADD COLUMN IF NOT EXISTS destination TEXT DEFAULT '';

            ALTER TABLE routes ADD COLUMN IF NOT EXISTS organization_name TEXT DEFAULT 'Sairam Engineering College';
            ALTER TABLE routes ADD COLUMN IF NOT EXISTS shuttle_id INT;
            ALTER TABLE routes ADD COLUMN IF NOT EXISTS landmark TEXT DEFAULT '';

            ALTER TABLE stops ADD COLUMN IF NOT EXISTS sequence_order INT DEFAULT 1;
            ALTER TABLE stops ADD COLUMN IF NOT EXISTS landmark TEXT DEFAULT '';
            ALTER TABLE stops ADD COLUMN IF NOT EXISTS eta_minutesFromStart INT DEFAULT 0;

            ALTER TABLE schedules ADD COLUMN IF NOT EXISTS organization_name TEXT DEFAULT 'Sairam Engineering College';
            ALTER TABLE schedules ADD COLUMN IF NOT EXISTS route_name TEXT DEFAULT '';
            ALTER TABLE schedules ADD COLUMN IF NOT EXISTS driver_points INT DEFAULT 0;
            ALTER TABLE schedules ADD COLUMN IF NOT EXISTS monthly_points INT DEFAULT 0;
            ALTER TABLE schedules ADD COLUMN IF NOT EXISTS yearly_points INT DEFAULT 0;
            ALTER TABLE schedules ADD COLUMN IF NOT EXISTS total_trips INT DEFAULT 0;
            ALTER TABLE schedules ADD COLUMN IF NOT EXISTS last_points_earned INT DEFAULT 0;

            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS organization_name TEXT DEFAULT 'Sairam Engineering College';

            CREATE TABLE IF NOT EXISTS driver_feedbacks (
              id SERIAL PRIMARY KEY,
              driver_id INT NOT NULL,
              shuttle_id INT,
              shuttle_code VARCHAR(30) DEFAULT '',
              passenger_id INT,
              passenger_name VARCHAR(120) DEFAULT 'Passenger',
              rating NUMERIC(3,2) NOT NULL DEFAULT 5.0,
              description TEXT DEFAULT '',
              month_key VARCHAR(20) NOT NULL,
              organization_name TEXT DEFAULT 'Sairam Engineering College',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS shuttle_emergency_reports (
              id SERIAL PRIMARY KEY,
              shuttle_id INT NOT NULL,
              bus_code VARCHAR(30) NOT NULL,
              passenger_id INT NOT NULL,
              passenger_name VARCHAR(120) DEFAULT 'Passenger',
              reported_at BIGINT NOT NULL,
              notified_admin BOOLEAN DEFAULT FALSE
            );

            CREATE TABLE IF NOT EXISTS system_migrations (
              key VARCHAR(100) PRIMARY KEY,
              applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS system_settings (
              id INT PRIMARY KEY DEFAULT 1,
              settings_json TEXT NOT NULL,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS organization_settings (
              org_key VARCHAR(255) PRIMARY KEY,
              organization_name TEXT NOT NULL,
              settings_json TEXT NOT NULL,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // 1b. One-time clean purge of all dummy data except Admin so user can test from a clean slate
          const migRes = await client.query(
            "SELECT key FROM system_migrations WHERE key = 'purge_all_dummy_data_v1' LIMIT 1"
          );
          if (!migRes.rows || migRes.rows.length === 0) {
            await client.query(`
              DELETE FROM shuttle_emergency_reports;
              DELETE FROM driver_feedbacks;
              DELETE FROM notifications;
              DELETE FROM schedules;
              DELETE FROM trips;
              DELETE FROM stops;
              DELETE FROM routes;
              DELETE FROM drivers;
              DELETE FROM shuttles;
              DELETE FROM users WHERE role != 'admin';
              INSERT INTO system_migrations (key) VALUES ('purge_all_dummy_data_v1') ON CONFLICT (key) DO NOTHING;
            `);
            console.log('🧹 Purged all dummy data from PostgreSQL (kept Admin account only).');
          }

          // 1c. Ensure dummy 'Main Campus Loop' schedules are removed and shuttles start as 'idle' until Driver presses Start Trip
          await client.query(`
            ALTER TABLE shuttles DROP CONSTRAINT IF EXISTS shuttles_status_check;
            DELETE FROM schedules WHERE route_name = 'Main Campus Loop';
            UPDATE shuttles SET status = 'idle';
          `);
          const migLoginRes = await client.query(
            "SELECT key FROM system_migrations WHERE key = 'reset_driver_has_logged_in_v1' LIMIT 1"
          );
          if (!migLoginRes.rows || migLoginRes.rows.length === 0) {
            await client.query(`
              UPDATE drivers SET has_logged_in = FALSE;
              INSERT INTO system_migrations (key) VALUES ('reset_driver_has_logged_in_v1') ON CONFLICT (key) DO NOTHING;
            `);
          }

          // 2. Ensure PostgreSQL SERIAL sequences are synced
          await client.query(`
            SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
            SELECT setval(pg_get_serial_sequence('drivers', 'id'), COALESCE((SELECT MAX(id) FROM drivers), 1));
            SELECT setval(pg_get_serial_sequence('routes', 'id'), COALESCE((SELECT MAX(id) FROM routes), 1));
            SELECT setval(pg_get_serial_sequence('stops', 'id'), COALESCE((SELECT MAX(id) FROM stops), 1));
            SELECT setval(pg_get_serial_sequence('shuttles', 'id'), COALESCE((SELECT MAX(id) FROM shuttles), 1));
            SELECT setval(pg_get_serial_sequence('trips', 'id'), COALESCE((SELECT MAX(id) FROM trips), 1));
            SELECT setval(pg_get_serial_sequence('schedules', 'id'), COALESCE((SELECT MAX(id) FROM schedules), 1));
            SELECT setval(pg_get_serial_sequence('notifications', 'id'), COALESCE((SELECT MAX(id) FROM notifications), 1));
          `);

          // 3. Restore saved Admin Settings & Per-Organization Settings from PostgreSQL
          try {
            const setRes = await client.query('SELECT settings_json FROM system_settings WHERE id = 1 LIMIT 1');
            if (setRes.rows && setRes.rows.length > 0 && setRes.rows[0].settings_json) {
              const parsedSettings = JSON.parse(setRes.rows[0].settings_json);
              store.settings = { ...store.settings, ...parsedSettings };
            }
            const orgSetRes = await client.query('SELECT org_key, organization_name, settings_json FROM organization_settings');
            if (orgSetRes.rows && orgSetRes.rows.length > 0) {
              if (!store.organization_settings) store.organization_settings = {};
              orgSetRes.rows.forEach((row) => {
                try {
                  const parsed = JSON.parse(row.settings_json);
                  store.org_settings[row.org_key] = parsed;
                  store.organization_settings[row.org_key] = parsed;
                } catch (_) {}
              });
            }
          } catch (_) {}

          const defaultOrgName = store.settings.organization_name || 'Sairam Engineering College';
          const defaultOrgKey = normalizeOrgKey(defaultOrgName);
          if (!store.organization_settings) store.organization_settings = {};
          if (!store.org_settings[defaultOrgKey]) {
            store.org_settings[defaultOrgKey] = { ...store.settings };
          }
          if (!store.organization_settings[defaultOrgKey]) {
            store.organization_settings[defaultOrgKey] = { ...store.settings };
          }

          // Backfill organization_name on existing records that had empty organization_name
          await client.query(
            `UPDATE users SET organization_name = $1 WHERE organization_name IS NULL OR TRIM(organization_name) = ''`,
            [defaultOrgName]
          );
          await client.query(
            `UPDATE shuttles SET organization_name = $1 WHERE organization_name IS NULL OR TRIM(organization_name) = ''`,
            [defaultOrgName]
          );
          await client.query(
            `UPDATE drivers SET organization_name = $1 WHERE organization_name IS NULL OR TRIM(organization_name) = ''`,
            [defaultOrgName]
          );
          await client.query(
            `UPDATE routes SET organization_name = $1 WHERE organization_name IS NULL OR TRIM(organization_name) = ''`,
            [defaultOrgName]
          );
          await client.query(
            `UPDATE schedules SET organization_name = $1 WHERE organization_name IS NULL OR TRIM(organization_name) = ''`,
            [defaultOrgName]
          );

          // 4. Sync existing users from PostgreSQL
          const res = await client.query('SELECT * FROM users ORDER BY id ASC');
          if (res.rows && res.rows.length > 0) {
            const pgUsers = res.rows.map((u) => ({
              ...u,
              organization_name: u.organization_name || defaultOrgName,
              passenger_code: u.role === 'user' ? `PSG-${100 + Number(u.id)}` : undefined,
              is_active: u.is_active !== false,
              bus_number: u.bus_number || null,
              plain_password: u.plain_password || ''
            }));
            store.users = pgUsers;
          }

          // 5. Sync routes, stops, and shuttles from PostgreSQL
          const routesRes = await client.query('SELECT * FROM routes ORDER BY id ASC');
          store.routes = (routesRes.rows || []).map((r) => ({
            ...r,
            organization_name: r.organization_name || defaultOrgName
          }));

          const stopsRes = await client.query('SELECT * FROM stops ORDER BY route_id ASC, sequence_order ASC, id ASC');
          store.stops = stopsRes.rows || [];

          // Verify all stops on each route have accurate geocoded coordinates matching their stop name
          for (const rt of store.routes) {
            const rtStops = store.stops
              .filter((s) => Number(s.route_id) === Number(rt.id))
              .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1));

            const sCoords = await geocodeLocation(rt.start_point || rtStops[0]?.name || 'Sairam Engineering College', 12.9602, 80.0569);
            const eCoords = await geocodeLocation(rt.end_point || rtStops[rtStops.length - 1]?.name || 'West Tambaram', 12.9249, 80.1000);

            if (rtStops.length === 0 && rt.start_point && rt.end_point) {
              const s1Res = await client.query(
                `INSERT INTO stops (route_id, name, sequence_order, latitude, longitude, landmark)
                 VALUES ($1, $2, 1, $3, $4, $5) RETURNING *`,
                [rt.id, rt.start_point, sCoords.lat, sCoords.lng, rt.landmark || 'Starting Point']
              );
              const s2Res = await client.query(
                `INSERT INTO stops (route_id, name, sequence_order, latitude, longitude, landmark)
                 VALUES ($1, $2, 2, $3, $4, $5) RETURNING *`,
                [rt.id, rt.end_point, eCoords.lat, eCoords.lng, 'Destination Terminal']
              );
              if (s1Res.rows[0]) store.stops.push(s1Res.rows[0]);
              if (s2Res.rows[0]) store.stops.push(s2Res.rows[0]);
            } else if (rtStops.length >= 2) {
              for (let idx = 0; idx < rtStops.length; idx++) {
                const st = rtStops[idx];
                st.sequence_order = idx + 1;
                if (!Number(st.latitude) || !Number(st.longitude)) {
                  const targetName =
                    idx === 0
                      ? rt.start_point || st.name
                      : idx === rtStops.length - 1
                      ? rt.end_point || st.name
                      : st.name;
                  const resolved = await geocodeLocation(targetName, sCoords.lat, sCoords.lng, {
                    startLat: sCoords.lat,
                    startLng: sCoords.lng,
                    endLat: eCoords.lat,
                    endLng: eCoords.lng,
                    fraction: idx / Math.max(1, rtStops.length - 1)
                  });
                  st.latitude = resolved.lat;
                  st.longitude = resolved.lng;
                }
                await client.query(
                  'UPDATE stops SET latitude = $1, longitude = $2, sequence_order = $3 WHERE id = $4',
                  [st.latitude, st.longitude, st.sequence_order, st.id]
                );
              }
              await db.recalculateRouteMetrics(rt.id);
            }
          }

          const shuttlesRes = await client.query('SELECT * FROM shuttles ORDER BY id ASC');
          store.shuttles = (shuttlesRes.rows || []).map((s) => {
            const r = store.routes.find((rt) => rt.id === s.current_route_id || Number(rt.shuttle_id) === Number(s.id));
            const rStops = r
              ? store.stops
                  .filter((st) => Number(st.route_id) === Number(r.id))
                  .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1))
              : [];
            const startSt = rStops[0];
            return {
              ...s,
              current_lat: startSt ? Number(startSt.latitude) : Number(s.current_lat),
              current_lng: startSt ? Number(startSt.longitude) : Number(s.current_lng),
              organization_name: s.organization_name || r?.organization_name || defaultOrgName,
              status: 'idle',
              speed: 0,
              current_route_id: s.current_route_id || (r ? r.id : null),
              start_point: s.start_point || (r ? r.start_point : ''),
              destination: s.destination || (r ? r.end_point : ''),
              passenger_emergency_reports: [],
              admin_emergency_stopped_notified_for_trip: false
            };
          });

          // 6. Sync existing drivers joined with users (including cumulative all-trips monthly & yearly points)
          const drvRes = await client.query(`
            SELECT d.*, u.name, u.email, u.organization_name AS user_org_name, u.avatar_url AS user_avatar_url, u.plain_password AS user_plain_password, u.is_active AS user_is_active
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            ORDER BY d.id ASC
          `);
          store.drivers = (drvRes.rows || []).map((d) => {
            const matchedShuttle = store.shuttles.find(
              (s) =>
                Number(s.id) === Number(d.assigned_shuttle_id) ||
                Number(s.current_driver_id) === Number(d.user_id)
            );
            const assignedShuttleId = d.assigned_shuttle_id || (matchedShuttle ? matchedShuttle.id : null);
            if (matchedShuttle && !matchedShuttle.current_driver_id) {
              matchedShuttle.current_driver_id = d.user_id;
            }
            const totalPts = Math.max(
              Number(d.driver_points) || 0,
              Number(d.yearly_points) || 0,
              Number(d.monthly_points) || 0
            );
            return {
              ...d,
              organization_name: d.organization_name || d.user_org_name || matchedShuttle?.organization_name || defaultOrgName,
              plain_password: d.user_plain_password || d.plain_password || '',
              is_active: d.user_is_active !== false && d.is_active !== false,
              has_logged_in: Boolean(d.has_logged_in),
              total_trips: Number(d.total_trips) || 0,
              driver_points: totalPts,
              monthly_points: Number(d.monthly_points) || totalPts,
              yearly_points: Number(d.yearly_points) || totalPts,
              assigned_shuttle_id: assignedShuttleId,
              avatar_url:
                d.avatar_url ||
                d.user_avatar_url ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(d.name || 'Driver')}`,
              license_photo_url: cleanUploadedLicenseUrl(d.license_photo_url)
            };
          });

          await client.query(`
            DELETE FROM driver_feedbacks a USING driver_feedbacks b
            WHERE a.id < b.id AND a.driver_id = b.driver_id AND COALESCE(a.passenger_id, 0) = COALESCE(b.passenger_id, 0);
          `);
          const fbRes = await client.query('SELECT * FROM driver_feedbacks ORDER BY created_at DESC');
          store.driver_feedbacks = fbRes.rows || [];

          // Recalculate and sync each driver's 30-day average rating from passenger feedbacks
          for (const drv of store.drivers) {
            const stats = computeDriverFeedbackStats(drv.id, drv.rating);
            drv.rating = stats.rating;
            await client.query('UPDATE drivers SET rating = $1 WHERE id = $2', [stats.rating, drv.id]);
          }

          await client.query(`
            DELETE FROM schedules
            WHERE shuttle_id = 1 AND departure_time IN ('08:30 AM', '10:00 AM');
            DELETE FROM notifications;
          `);
          const schedRes = await client.query('SELECT * FROM schedules ORDER BY id ASC');
          store.schedules = (schedRes.rows || []).map((sc) => ({
            ...sc,
            organization_name: sc.organization_name || defaultOrgName,
            driver_points: Number(sc.driver_points) || 0,
            monthly_points: Number(sc.monthly_points) || Number(sc.driver_points) || 0,
            yearly_points: Number(sc.yearly_points) || Number(sc.driver_points) || 0,
            total_trips: Number(sc.total_trips) || 0,
            last_points_earned: Number(sc.last_points_earned) || 0
          }));

          // 7. Restore active 15-minute passenger emergency reports from PostgreSQL
          const cutoffMs = Date.now() - 15 * 60 * 1000;
          await client.query('DELETE FROM shuttle_emergency_reports WHERE reported_at < $1', [cutoffMs]);
          const emgRes = await client.query(
            'SELECT * FROM shuttle_emergency_reports WHERE reported_at >= $1 ORDER BY reported_at ASC',
            [cutoffMs]
          );
          if (emgRes.rows && emgRes.rows.length > 0) {
            emgRes.rows.forEach((row) => {
              const sh = store.shuttles.find((s) => Number(s.id) === Number(row.shuttle_id));
              const sc = store.schedules.find((s) => Number(s.shuttle_id) === Number(row.shuttle_id));
              const reportItem = {
                passengerId: Number(row.passenger_id),
                passengerName: row.passenger_name || 'Passenger',
                busCode: row.bus_code,
                timestamp: Number(row.reported_at),
                expiresAt: Number(row.reported_at) + 15 * 60 * 1000
              };
              if (sh) {
                if (!Array.isArray(sh.passenger_emergency_reports)) sh.passenger_emergency_reports = [];
                if (!sh.passenger_emergency_reports.some((r) => Number(r.passengerId) === reportItem.passengerId)) {
                  sh.passenger_emergency_reports.push(reportItem);
                }
                if (row.notified_admin || sh.passenger_emergency_reports.length >= 5) {
                  sh.admin_emergency_stopped_notified_for_trip = true;
                }
              }
              if (sc) {
                if (!Array.isArray(sc.passenger_emergency_reports)) sc.passenger_emergency_reports = [];
                if (!sc.passenger_emergency_reports.some((r) => Number(r.passengerId) === reportItem.passengerId)) {
                  sc.passenger_emergency_reports.push(reportItem);
                }
                if (row.notified_admin || sc.passenger_emergency_reports.length >= 5) {
                  sc.admin_emergency_stopped_notified_for_trip = true;
                }
              }
            });
          }

          // Recalculate exact OSRM road distances for all routes on startup
          for (const rt of store.routes) {
            await db.recalculateRouteMetrics(rt.id);
          }

          store.notifications = [];
        } catch (syncErr) {
          console.warn('Schema migration / sync notice:', syncErr.message);
        }
        release();
        isPostgresConnected = true;
        console.log('✅ Connected to PostgreSQL + PostGIS database.');
      }
    });
  } catch (err) {
    console.warn('⚠️  Error initializing PostgreSQL pool. Using fallback storage.');
  }
} else {
  console.log('ℹ️  No DATABASE_URL configured. Running with embedded in-memory repository.');
}

// Unified repository methods
const db = {
  isPostgres: () => isPostgresConnected,
  getStore: () => store,
  geocodeLocation,
  calculateDistanceKm,
  isTimeWithinScheduleWindow,
  getShuttleScheduleContext,
  normalizeOrgKey,
  matchesOrg,

  markDriverLoggedIn: async (userId) => {
    const drv = store.drivers.find((d) => Number(d.user_id) === Number(userId));
    if (drv) {
      drv.has_logged_in = true;
      drv.status = 'on_duty';
    }
    if (isPostgresConnected && pool) {
      try {
        await pool.query(
          `UPDATE drivers SET has_logged_in = TRUE, status = 'on_duty' WHERE user_id = $1`,
          [Number(userId)]
        );
      } catch (_) {}
    }
    return drv;
  },

  // Users
  findUserByEmail: async (email, options = {}) => {
    const normalized = String(email || '').trim().toLowerCase();
    const memMatch = store.users.find((u) => u.email && u.email.toLowerCase() === normalized);
    if (options.memoryOnly || memMatch) {
      return memMatch;
    }
    if (isPostgresConnected && pool) {
      try {
        const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [normalized]);
        if (rows.length > 0) {
          const u = rows[0];
          const memIdx = store.users.findIndex((m) => m.id === u.id);
          if (memIdx !== -1) store.users[memIdx] = { ...store.users[memIdx], ...u };
          else store.users.push(u);
          return u;
        }
      } catch (_) {}
    }
    return memMatch;
  },

  findUserById: async (id) => {
    if (isPostgresConnected && pool) {
      try {
        const { rows } = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [Number(id)]);
        if (rows.length > 0) return rows[0];
      } catch (_) {}
    }
    return store.users.find((u) => u.id === Number(id));
  },

  createUser: async (userData) => {
    let newUser = {
      id: store.users.length ? Math.max(...store.users.map((u) => u.id)) + 1 : 1,
      ...userData,
      organization_name: userData.organization_name || '',
      bus_number: userData.bus_number || '',
      destination: userData.destination || '',
      id_card_url: userData.id_card_url || '',
      plain_password: userData.plain_password || '',
      is_active: userData.is_active !== false,
      created_at: new Date().toISOString()
    };

    if (isPostgresConnected && pool) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO users (name, email, password_hash, role, phone, avatar_url, organization_name, bus_number, destination, id_card_url, plain_password, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            newUser.name,
            newUser.email,
            newUser.password_hash,
            newUser.role,
            newUser.phone || '',
            newUser.avatar_url || '',
            newUser.organization_name,
            newUser.bus_number,
            newUser.destination,
            newUser.id_card_url,
            newUser.plain_password,
            newUser.is_active
          ]
        );
        if (rows.length > 0) newUser = { ...newUser, ...rows[0] };
      } catch (err) {
        console.warn('Postgres createUser sync warning:', err.message);
      }
    }

    store.users.push(newUser);

    if (newUser.role === 'driver') {
      const licenseNumber = `DL-${Math.floor(100000 + Math.random() * 900000)}`;
      const newDriver = {
        id: store.drivers.length ? Math.max(...store.drivers.map((d) => d.id)) + 1 : 1,
        user_id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone || '',
        license_number: licenseNumber,
        experience_years: 3,
        status: 'available',
        rating: 5.0,
        total_trips: 0,
        assigned_shuttle_id: null,
        plain_password: newUser.plain_password || 'driver123',
        is_active: true,
        has_logged_in: false,
        license_photo_url: '',
        created_at: new Date().toISOString()
      };

      if (isPostgresConnected && pool) {
        try {
          const { rows: dRows } = await pool.query(
            `INSERT INTO drivers (user_id, license_number, experience_years, status, rating, phone, plain_password, is_active, has_logged_in)
             VALUES ($1, $2, 3, 'available', 5.0, $3, $4, true, false)
             RETURNING *`,
            [newUser.id, licenseNumber, newDriver.phone, newDriver.plain_password]
          );
          if (dRows.length > 0) newDriver.id = dRows[0].id;
        } catch (_) {}
      }

      store.drivers.push(newDriver);
    }

    return newUser;
  },

  updateUserPassword: async (email, password_hash, plain_password = '') => {
    if (isPostgresConnected && pool) {
      try {
        await pool.query(
          'UPDATE users SET password_hash = $1, plain_password = $2, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER($3)',
          [password_hash, plain_password, email]
        );
        await pool.query(
          `UPDATE drivers SET plain_password = $1
           WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER($2))`,
          [plain_password, email]
        );
      } catch (_) {}
    }
    const user = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      user.password_hash = password_hash;
      if (plain_password) user.plain_password = plain_password;
    }
    const driver = store.drivers.find((d) => d.email && d.email.toLowerCase() === email.toLowerCase());
    if (driver && plain_password) {
      driver.plain_password = plain_password;
    }
    return user;
  },

  getAllUsers: async (orgName = null) => {
    const filtered = orgName
      ? store.users.filter((u) => matchesOrg(u.organization_name, orgName))
      : store.users;
    return filtered.map((u) =>
      u.role === 'user' ? formatPassengerRecord(u) : (({ password_hash, ...rest }) => rest)(u)
    );
  },

  getPassengersByBus: async (busCode, orgName = null) => {
    const passengers = store.users.filter(
      (u) => u.role === 'user' && (!orgName || matchesOrg(u.organization_name, orgName))
    );
    if (!busCode || busCode === 'ALL') {
      return passengers.map((u) => formatPassengerRecord(u));
    }
    return passengers
      .filter((u) => !u.bus_number || u.bus_number.toUpperCase() === busCode.toUpperCase())
      .map((u) => formatPassengerRecord(u, busCode));
  },

  // Shuttles
  getAllShuttles: async (orgName = null) => {
    const filtered = orgName
      ? store.shuttles.filter((s) => matchesOrg(s.organization_name, orgName))
      : store.shuttles;
    const list = filtered.length > 0 ? filtered : store.shuttles;
    return list.map((shuttle) => {
      const driver = resolveDriverForShuttle(shuttle);
      const driverUser = driver ? store.users.find((u) => u.id === driver.user_id) : null;
      const driverStats = driver ? computeDriverFeedbackStats(driver.id, driver.rating) : null;
      const route = resolveRouteForShuttle(shuttle);
      const stops = route
        ? store.stops.filter((s) => s.route_id === route.id).sort((a, b) => a.sequence_order - b.sequence_order)
        : [];
      const nextStop = store.stops.find((s) => s.id === shuttle.next_stop_id);
      const registeredPassengers = store.users.filter(
        (u) =>
          u.role === 'user' &&
          u.bus_number &&
          u.bus_number.toUpperCase() === (shuttle.code || '').toUpperCase() &&
          matchesOrg(u.organization_name, shuttle.organization_name)
      );
      const schedCtx = getShuttleScheduleContext(shuttle.id);
      const activeSchedule = schedCtx.activeSchedule;
      const isOnTrip = shuttle.status === 'on_trip';
      const startStop = stops[0];
      const effectiveLat = !isOnTrip && startStop ? Number(startStop.latitude) : Number(shuttle.current_lat);
      const effectiveLng = !isOnTrip && startStop ? Number(startStop.longitude) : Number(shuttle.current_lng);
      const distanceCoveredKm = !isOnTrip
        ? 0
        : startStop
        ? calculateDistanceKm(
            Number(startStop.latitude),
            Number(startStop.longitude),
            effectiveLat || Number(startStop.latitude),
            effectiveLng || Number(startStop.longitude)
          )
        : 0;
      const nowMs = Date.now();
      const rawReports = Array.isArray(shuttle.passenger_emergency_reports)
        ? shuttle.passenger_emergency_reports
        : Array.isArray(activeSchedule?.passenger_emergency_reports)
        ? activeSchedule.passenger_emergency_reports
        : [];
      const recentPassengerEmergencies = rawReports.filter((r) => nowMs - Number(r.timestamp || 0) <= 15 * 60 * 1000);
      shuttle.passenger_emergency_reports = recentPassengerEmergencies;
      if (recentPassengerEmergencies.length === 0 && rawReports.length > 0) {
        shuttle.admin_emergency_stopped_notified_for_trip = false;
        if (activeSchedule) {
          activeSchedule.passenger_emergency_reports = [];
          activeSchedule.admin_emergency_stopped_notified_for_trip = false;
        }
      }
      const resolvedStart = shuttle.start_point || (route ? route.start_point : '');
      const resolvedDest = shuttle.destination || (route ? route.end_point : '');
      return {
        ...shuttle,
        current_lat: effectiveLat,
        current_lng: effectiveLng,
        organization_name: shuttle.organization_name || store.settings.organization_name || 'Sairam Engineering College',
        is_on_trip: isOnTrip,
        is_scheduled_time_now: schedCtx.isScheduledTimeNow,
        has_schedule: schedCtx.hasSchedule,
        schedule_departure_time: activeSchedule?.departure_time || null,
        schedule_arrival_time: activeSchedule?.arrival_time || null,
        driver_not_started_at_schedule: Boolean(
          schedCtx.isScheduledTimeNow && !isOnTrip && !activeSchedule?.driver_arrived
        ),
        start_point: resolvedStart,
        destination: resolvedDest,
        driver_id: driver ? driver.id : null,
        driver_code: driver ? driver.driver_code || `DRV-${100 + Number(driver.id)}` : null,
        driver_name: driver ? driverUser?.name || driver.name : null,
        driver_email: driver ? driverUser?.email || driver.email : null,
        driver_phone: driver ? driver.phone : null,
        driver_license_number: driver ? driver.license_number : null,
        driver_license_photo_url: driver ? cleanUploadedLicenseUrl(driver.license_photo_url) : '',
        driver_avatar:
          (driver && driver.avatar_url) ||
          (driverUser && driverUser.avatar_url) ||
          (driver ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(driver.name || 'D')}` : null),
        driver_rating: driverStats ? driverStats.rating : driver ? driver.rating : 5.0,
        driver_feedback_count: driverStats ? driverStats.feedbackCount : 0,
        driver_feedbacks: driverStats ? driverStats.feedbacks : [],
        driver_experience: driver ? driver.experience_years : null,
        driver_is_active: driver ? driver.is_active !== false : true,
        driver_has_logged_in: driver ? Boolean(driver.has_logged_in) : false,
        route_name: route ? route.name : resolvedStart && resolvedDest ? `${resolvedStart} ➔ ${resolvedDest}` : null,
        route_code: route ? route.code : null,
        route_color: route ? route.color : '#2563EB',
        route,
        stops,
        next_stop_name: !isOnTrip
          ? 'Trip Not Started'
          : nextStop
          ? nextStop.name
          : shuttle.next_stop_name || resolvedDest || 'In Transit',
        passengers_count: registeredPassengers.length,
        distance_covered_km: distanceCoveredKm,
        passengerEmergencyReports: recentPassengerEmergencies,
        passengerEmergencyCount: Math.min(10, recentPassengerEmergencies.length),
        passengerEmergencyMax: 10,
        passengerEmergencyRequired: 5,
        emergencyStoppedNotifiedForTrip: Boolean(
          shuttle.admin_emergency_stopped_notified_for_trip || activeSchedule?.admin_emergency_stopped_notified_for_trip
        ),
        stopReachedTimes: shuttle.stop_reached_times || {},
        trafficDelayStop: shuttle.traffic_delay_stop || null
      };
    });
  },

  getShuttleById: async (id) => {
    const shuttle = store.shuttles.find((s) => s.id === Number(id));
    if (!shuttle) return null;
    const driver = resolveDriverForShuttle(shuttle);
    const driverUser = driver ? store.users.find((u) => u.id === driver.user_id) : null;
    const driverStats = driver ? computeDriverFeedbackStats(driver.id, driver.rating) : null;
    const route = resolveRouteForShuttle(shuttle);
    const stops = route
      ? store.stops.filter((s) => s.route_id === route.id).sort((a, b) => a.sequence_order - b.sequence_order)
      : [];
    const schedCtx = getShuttleScheduleContext(shuttle.id);
    const activeSchedule = schedCtx.activeSchedule;
    const isOnTrip = shuttle.status === 'on_trip';
    const startStop = stops[0];
    const effectiveLat = !isOnTrip && startStop ? Number(startStop.latitude) : Number(shuttle.current_lat);
    const effectiveLng = !isOnTrip && startStop ? Number(startStop.longitude) : Number(shuttle.current_lng);
    const distanceCoveredKm = !isOnTrip
      ? 0
      : startStop
      ? calculateDistanceKm(
          Number(startStop.latitude),
          Number(startStop.longitude),
          effectiveLat || Number(startStop.latitude),
          effectiveLng || Number(startStop.longitude)
        )
      : 0;
    const nowMs = Date.now();
    const rawReports = Array.isArray(shuttle.passenger_emergency_reports)
      ? shuttle.passenger_emergency_reports
      : Array.isArray(activeSchedule?.passenger_emergency_reports)
      ? activeSchedule.passenger_emergency_reports
      : [];
    const recentPassengerEmergencies = rawReports.filter((r) => nowMs - Number(r.timestamp || 0) <= 15 * 60 * 1000);
    shuttle.passenger_emergency_reports = recentPassengerEmergencies;
    if (recentPassengerEmergencies.length === 0 && rawReports.length > 0) {
      shuttle.admin_emergency_stopped_notified_for_trip = false;
      if (activeSchedule) {
        activeSchedule.passenger_emergency_reports = [];
        activeSchedule.admin_emergency_stopped_notified_for_trip = false;
      }
    }
    const resolvedStart = shuttle.start_point || (route ? route.start_point : '');
    const resolvedDest = shuttle.destination || (route ? route.end_point : '');
    return {
      ...shuttle,
      current_lat: effectiveLat,
      current_lng: effectiveLng,
      organization_name: shuttle.organization_name || store.settings.organization_name || 'Sairam Engineering College',
      is_on_trip: isOnTrip,
      is_scheduled_time_now: schedCtx.isScheduledTimeNow,
      has_schedule: schedCtx.hasSchedule,
      schedule_departure_time: activeSchedule?.departure_time || null,
      schedule_arrival_time: activeSchedule?.arrival_time || null,
      driver_not_started_at_schedule: Boolean(
        schedCtx.isScheduledTimeNow && !isOnTrip && !activeSchedule?.driver_arrived
      ),
      start_point: resolvedStart,
      destination: resolvedDest,
      driver_id: driver ? driver.id : null,
      driver_code: driver ? driver.driver_code || `DRV-${100 + Number(driver.id)}` : null,
      driver_name: driver ? driverUser?.name || driver.name : null,
      driver_email: driver ? driverUser?.email || driver.email : null,
      driver_phone: driver ? driver.phone : null,
      driver_license_number: driver ? driver.license_number : null,
      driver_license_photo_url: driver ? cleanUploadedLicenseUrl(driver.license_photo_url) : '',
      driver_avatar:
        (driver && driver.avatar_url) ||
        (driverUser && driverUser.avatar_url) ||
        (driver ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(driver.name || 'D')}` : null),
      driver_rating: driverStats ? driverStats.rating : driver ? driver.rating : 5.0,
      driver_feedback_count: driverStats ? driverStats.feedbackCount : 0,
      driver_feedbacks: driverStats ? driverStats.feedbacks : [],
      driver_has_logged_in: driver ? Boolean(driver.has_logged_in) : false,
      route,
      stops,
      distance_covered_km: distanceCoveredKm,
      passengerEmergencyReports: recentPassengerEmergencies,
      passengerEmergencyCount: Math.min(10, recentPassengerEmergencies.length),
      passengerEmergencyMax: 10,
      passengerEmergencyRequired: 5,
      emergencyStoppedNotifiedForTrip: Boolean(
        shuttle.admin_emergency_stopped_notified_for_trip || activeSchedule?.admin_emergency_stopped_notified_for_trip
      ),
      stopReachedTimes: shuttle.stop_reached_times || {},
      trafficDelayStop: shuttle.traffic_delay_stop || null
    };
  },

  createShuttle: async (shuttleData) => {
    const startPoint = (shuttleData.start_point || '').trim();
    const destination = (shuttleData.destination || '').trim();
    const orgName = String(
      shuttleData.organization_name || store.settings.organization_name || 'Sairam Engineering College'
    ).trim();
    const startCoords = await geocodeLocation(startPoint, 12.9602, 80.0569);
    const destCoords = await geocodeLocation(destination, 12.9249, 80.1000);

    let newShuttle = {
      id: store.shuttles.length ? Math.max(...store.shuttles.map((s) => s.id)) + 1 : 1,
      code: (shuttleData.code || `S0${store.shuttles.length + 1}`).toUpperCase(),
      name: shuttleData.name,
      vehicle_number: shuttleData.vehicle_number,
      capacity: Number(shuttleData.capacity) || 32,
      status: 'idle',
      organization_name: orgName,
      start_point: startPoint,
      destination: destination,
      current_lat: Number(shuttleData.current_lat) || startCoords.lat,
      current_lng: Number(shuttleData.current_lng) || startCoords.lng,
      current_route_id: shuttleData.current_route_id ? Number(shuttleData.current_route_id) : null,
      current_driver_id: shuttleData.current_driver_id ? Number(shuttleData.current_driver_id) : null,
      speed: 0,
      heading: 65,
      eta_minutes: Math.max(5, Math.round((calculateDistanceKm(startCoords.lat, startCoords.lng, destCoords.lat, destCoords.lng) / 24) * 60)),
      distance_km: calculateDistanceKm(startCoords.lat, startCoords.lng, destCoords.lat, destCoords.lng),
      next_stop_name: 'Trip Not Started',
      updated_at: new Date().toISOString()
    };

    if (isPostgresConnected && pool) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO shuttles (code, name, vehicle_number, capacity, status, current_lat, current_lng, current_route_id, current_driver_id, start_point, destination, organization_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            newShuttle.code,
            newShuttle.name,
            newShuttle.vehicle_number,
            newShuttle.capacity,
            newShuttle.status,
            newShuttle.current_lat,
            newShuttle.current_lng,
            newShuttle.current_route_id,
            newShuttle.current_driver_id,
            newShuttle.start_point,
            newShuttle.destination,
            newShuttle.organization_name
          ]
        );
        if (rows.length > 0) newShuttle = { ...newShuttle, ...rows[0] };
      } catch (err) {
        console.warn('Postgres createShuttle sync warning:', err.message);
      }
    }

    store.shuttles.push(newShuttle);
    return newShuttle;
  },

  updateShuttle: async (id, updateData) => {
    let index = store.shuttles.findIndex((s) => Number(s.id) === Number(id));
    if (index === -1 && store.shuttles.length > 0) {
      index = 0;
    }
    if (index === -1) {
      return {
        id: Number(id) || 1,
        code: `S0${Number(id) || 1}`,
        status: updateData.status || 'idle',
        speed: updateData.speed ?? 0,
        ...updateData
      };
    }

    const current = store.shuttles[index];
    const oldCode = current.code;

    const nextShuttle = {
      ...current,
      ...updateData,
      code: updateData.code ? updateData.code.trim().toUpperCase() : current.code,
      name: updateData.name ? updateData.name.trim() : current.name || `Shuttle ${updateData.code || current.code}`,
      capacity: updateData.capacity !== undefined ? Number(updateData.capacity) : current.capacity,
      updated_at: new Date().toISOString()
    };

    const isAdminConfigChange =
      updateData.code !== undefined ||
      updateData.name !== undefined ||
      updateData.vehicle_number !== undefined ||
      updateData.capacity !== undefined ||
      updateData.start_point !== undefined ||
      updateData.destination !== undefined ||
      updateData.status === 'inactive' ||
      updateData.status === 'active';

    // Geocode real start_point & destination when edited by Admin (never use moving bus current_lat as startCoords!)
    let startCoords = null;
    let destCoords = null;

    if (isAdminConfigChange && (updateData.start_point !== undefined || updateData.destination !== undefined)) {
      startCoords = await geocodeLocation(
        nextShuttle.start_point,
        Number(current.current_lat) || 12.9602,
        Number(current.current_lng) || 80.0569
      );
      destCoords = await geocodeLocation(nextShuttle.destination, 12.9249, 80.1000);

      if (updateData.start_point && updateData.start_point !== current.start_point && !updateData.current_lat) {
        nextShuttle.current_lat = startCoords.lat;
        nextShuttle.current_lng = startCoords.lng;
      }
      if (updateData.destination && updateData.destination !== current.destination) {
        nextShuttle.next_stop_name = updateData.destination.trim();
      }
    }

    store.shuttles[index] = nextShuttle;

    // 1. If Bus Number (code) was changed in Edit, propagate to all passengers registered for that bus
    if (oldCode && nextShuttle.code && oldCode.toUpperCase() !== nextShuttle.code.toUpperCase()) {
      store.users.forEach((u) => {
        if (u.bus_number && u.bus_number.toUpperCase() === oldCode.toUpperCase()) {
          u.bus_number = nextShuttle.code;
        }
      });
      if (isPostgresConnected && pool) {
        try {
          await pool.query('UPDATE users SET bus_number = $1 WHERE UPPER(bus_number) = UPPER($2)', [
            nextShuttle.code,
            oldCode
          ]);
        } catch (_) {}
      }
    }

    // 2. If Starting Point or Destination was changed in Edit, propagate to the linked Route, Stops, & Schedules without swapping stop names!
    if (
      isAdminConfigChange &&
      (updateData.start_point !== undefined || updateData.destination !== undefined) &&
      startCoords &&
      destCoords
    ) {
      const linkedRoute = store.routes.find(
        (r) => r.id === nextShuttle.current_route_id || Number(r.shuttle_id) === Number(nextShuttle.id)
      );
      if (linkedRoute) {
        if (updateData.start_point) linkedRoute.start_point = updateData.start_point.trim();
        if (updateData.destination) linkedRoute.end_point = updateData.destination.trim();
        linkedRoute.distance_km = calculateDistanceKm(
          startCoords.lat,
          startCoords.lng,
          destCoords.lat,
          destCoords.lng
        );
        linkedRoute.estimated_time_minutes = Math.max(5, Math.round((linkedRoute.distance_km / 24) * 60));

        const routeStops = store.stops
          .filter((st) => st.route_id === linkedRoute.id)
          .sort((a, b) => a.sequence_order - b.sequence_order);

        if (routeStops.length > 0 && updateData.start_point !== undefined) {
          routeStops[0].name = linkedRoute.start_point;
          routeStops[0].latitude = startCoords.lat;
          routeStops[0].longitude = startCoords.lng;
        }
        if (routeStops.length > 1 && updateData.destination !== undefined) {
          const lastStop = routeStops[routeStops.length - 1];
          lastStop.name = linkedRoute.end_point;
          lastStop.latitude = destCoords.lat;
          lastStop.longitude = destCoords.lng;
        }

        for (let idx = 0; idx < routeStops.length; idx++) {
          routeStops[idx].sequence_order = idx + 1;
          if (isPostgresConnected && pool) {
            try {
              await pool.query(
                'UPDATE stops SET name = $1, latitude = $2, longitude = $3, sequence_order = $4 WHERE id = $5',
                [
                  routeStops[idx].name,
                  routeStops[idx].latitude,
                  routeStops[idx].longitude,
                  routeStops[idx].sequence_order,
                  routeStops[idx].id
                ]
              );
            } catch (_) {}
          }
        }

        if (isPostgresConnected && pool) {
          try {
            await pool.query(
              'UPDATE routes SET start_point = $1, end_point = $2, distance_km = $3, estimated_time_minutes = $4 WHERE id = $5',
              [
                linkedRoute.start_point,
                linkedRoute.end_point,
                linkedRoute.distance_km,
                linkedRoute.estimated_time_minutes,
                linkedRoute.id
              ]
            );
          } catch (_) {}
        }
      }
    }

    // 3. Persist Shuttle changes to PostgreSQL
    if (isPostgresConnected && pool) {
      try {
        if (isAdminConfigChange) {
          await pool.query(
            `UPDATE shuttles
             SET code = $1, name = $2, vehicle_number = $3, capacity = $4, status = $5,
                 start_point = $6, destination = $7, current_route_id = $8, current_driver_id = $9,
                 current_lat = $10, current_lng = $11, updated_at = CURRENT_TIMESTAMP
             WHERE id = $12`,
            [
              nextShuttle.code,
              nextShuttle.name,
              nextShuttle.vehicle_number,
              Number(nextShuttle.capacity) || 32,
              nextShuttle.status,
              nextShuttle.start_point || '',
              nextShuttle.destination || '',
              nextShuttle.current_route_id,
              nextShuttle.current_driver_id,
              nextShuttle.current_lat,
              nextShuttle.current_lng,
              Number(nextShuttle.id)
            ]
          );
        } else if (updateData.status !== undefined) {
          await pool.query(
            'UPDATE shuttles SET status = $1, current_lat = $2, current_lng = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
            [nextShuttle.status, nextShuttle.current_lat, nextShuttle.current_lng, Number(nextShuttle.id)]
          );
        }
      } catch (_) {}
    }

    return store.shuttles[index];
  },

  deleteShuttle: async (id) => {
    const index = store.shuttles.findIndex((s) => s.id === Number(id));
    if (index === -1) return false;
    if (isPostgresConnected && pool) {
      try {
        await pool.query('DELETE FROM shuttles WHERE id = $1', [Number(id)]);
      } catch (_) {}
    }
    store.shuttles.splice(index, 1);
    return true;
  },

  // Drivers
  getAllDrivers: async (orgName = null) => {
    const allPassengers = store.users
      .filter((u) => u.role === 'user' && (!orgName || matchesOrg(u.organization_name, orgName)))
      .map((u) => formatPassengerRecord(u));

    const driverList = orgName
      ? store.drivers.filter((d) => matchesOrg(d.organization_name, orgName))
      : store.drivers;

    return driverList.map((driver) => {
      const userObj = store.users.find((u) => u.id === driver.user_id);
      const assignedShuttle = store.shuttles.find(
        (s) =>
          Number(s.id) === Number(driver.assigned_shuttle_id) ||
          (s.current_driver_id && Number(s.current_driver_id) === Number(driver.user_id))
      );
      const busCode = assignedShuttle ? assignedShuttle.code : null;
      const feedbackStats = computeDriverFeedbackStats(driver.id, driver.rating);
      const routePassengers = busCode
        ? allPassengers.filter(
            (u) => (u.bus_number || '').toUpperCase() === busCode.toUpperCase()
          )
        : [];
      const totalPts = Math.max(
        Number(driver.driver_points) || 0,
        Number(driver.yearly_points) || 0,
        Number(driver.monthly_points) || 0
      );

      return {
        ...driver,
        organization_name: driver.organization_name || userObj?.organization_name || store.settings.organization_name || 'Sairam Engineering College',
        driver_code: driver.driver_code || `DRV-${100 + Number(driver.id)}`,
        name: userObj ? userObj.name : driver.name,
        email: userObj ? userObj.email : driver.email,
        avatar_url:
          driver.avatar_url ||
          (userObj && userObj.avatar_url) ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(driver.name || 'Driver')}`,
        license_photo_url: cleanUploadedLicenseUrl(driver.license_photo_url),
        rating: feedbackStats.rating,
        feedback_count: feedbackStats.feedbackCount,
        feedbacks: feedbackStats.feedbacks,
        routePassengers,
        allPassengers,
        driver_points: totalPts,
        monthly_points: Number(driver.monthly_points) || totalPts,
        yearly_points: Number(driver.yearly_points) || totalPts,
        total_trips: Number(driver.total_trips) || 0,
        plain_password:
          (userObj && userObj.plain_password) || driver.plain_password || 'driver123',
        is_active:
          driver.is_active !== false &&
          (!userObj || userObj.is_active !== false),
        has_logged_in: Boolean(driver.has_logged_in),
        assigned_shuttle_id: assignedShuttle ? assignedShuttle.id : driver.assigned_shuttle_id,
        assigned_shuttle_code: assignedShuttle ? assignedShuttle.code : null,
        assigned_shuttle_name: assignedShuttle ? assignedShuttle.name : null,
        assigned_shuttle_plate: assignedShuttle ? assignedShuttle.vehicle_number : null,
        assigned_route_start: assignedShuttle ? assignedShuttle.start_point : null,
        assigned_route_dest: assignedShuttle ? assignedShuttle.destination : null
      };
    });
  },

  getDriverByUserId: async (userId) => {
    let driver = store.drivers.find((d) => d.user_id === Number(userId));
    if (!driver && isPostgresConnected && pool) {
      try {
        const { rows } = await pool.query(
          `SELECT d.*, u.name, u.email, u.organization_name AS user_org_name, u.avatar_url AS user_avatar_url, u.plain_password FROM drivers d JOIN users u ON d.user_id = u.id WHERE d.user_id = $1 LIMIT 1`,
          [Number(userId)]
        );
        if (rows.length > 0) {
          driver = {
            ...rows[0],
            organization_name: rows[0].organization_name || rows[0].user_org_name || store.settings.organization_name,
            driver_code: rows[0].driver_code || `DRV-${100 + Number(rows[0].id)}`,
            avatar_url: rows[0].avatar_url || rows[0].user_avatar_url || '',
            license_photo_url: cleanUploadedLicenseUrl(rows[0].license_photo_url),
            has_logged_in: Boolean(rows[0].has_logged_in),
            total_trips: Number(rows[0].total_trips) || 0,
            driver_points: Number(rows[0].driver_points) || 0,
            monthly_points: Number(rows[0].monthly_points) || Number(rows[0].driver_points) || 0,
            yearly_points: Number(rows[0].yearly_points) || Number(rows[0].driver_points) || 0,
            assigned_shuttle_id: rows[0].assigned_shuttle_id || null
          };
          store.drivers.push(driver);
        }
      } catch (_) {}
    }
    if (!driver) return null;

    const userObj = store.users.find((u) => u.id === driver.user_id);
    const driverOrg =
      driver.organization_name ||
      userObj?.organization_name ||
      store.settings.organization_name ||
      'Sairam Engineering College';
    const orgShuttles = store.shuttles.filter((s) => matchesOrg(s.organization_name, driverOrg));
    const assignedShuttle =
      store.shuttles.find(
        (s) => s.id === driver.assigned_shuttle_id || s.current_driver_id === driver.user_id
      ) || orgShuttles[0] || store.shuttles[0] || null;
    const activeRoute =
      assignedShuttle && assignedShuttle.current_route_id
        ? store.routes.find((r) => r.id === assignedShuttle.current_route_id)
        : store.routes.find((r) => r.shuttle_id === assignedShuttle?.id) || store.routes[0] || null;
    const stops = activeRoute
      ? store.stops.filter((s) => s.route_id === activeRoute.id).sort((a, b) => a.sequence_order - b.sequence_order)
      : [];

    const busCode = assignedShuttle?.code || '';
    const routePassengers = busCode
      ? store.users
          .filter(
            (u) =>
              u.role === 'user' &&
              (u.bus_number || '').toUpperCase() === busCode.toUpperCase() &&
              matchesOrg(u.organization_name, driverOrg)
          )
          .map((u) => formatPassengerRecord(u, busCode))
      : [];

    const feedbackStats = computeDriverFeedbackStats(driver.id, driver.rating);
    const schedCtx = assignedShuttle ? getShuttleScheduleContext(assignedShuttle.id) : null;
    const activeSchedule = schedCtx ? schedCtx.activeSchedule : null;

    const driverSchedules = assignedShuttle
      ? store.schedules
          .filter((sc) => Number(sc.shuttle_id) === Number(assignedShuttle.id))
          .map((sc) => {
            const minsUntil = getMinutesUntilDeparture(sc.departure_time);
            const inWin = isTimeWithinScheduleWindow(sc.departure_time, sc.arrival_time);
            return {
              ...sc,
              start_point: assignedShuttle.start_point || activeRoute?.start_point || '',
              destination: assignedShuttle.destination || activeRoute?.end_point || '',
              is_scheduled_time_now: inWin,
              minutes_until_departure: minsUntil,
              is_approaching_soon: minsUntil !== null && minsUntil >= 0 && minsUntil <= 60,
              driver_points: Number(sc.driver_points) || 0,
              monthly_points: Number(sc.monthly_points) || Number(sc.driver_points) || 0,
              yearly_points: Number(sc.yearly_points) || Number(sc.driver_points) || 0,
              last_points_earned: Number(sc.last_points_earned) || 0,
              total_trips: Number(sc.total_trips) || Number(sc.daily_trips) || 0
            };
          })
      : [];

    const driverNotifications = store.notifications.filter(
      (n) =>
        (n.user_id && Number(n.user_id) === Number(driver.user_id)) ||
        (n.type === 'driver_schedule' && assignedShuttle && Number(n.shuttle_id) === Number(assignedShuttle.id))
    );

    const schedulePointsSum = driverSchedules.reduce((sum, sc) => sum + (Number(sc.driver_points) || 0), 0);
    const totalDriverPoints = Math.max(
      Number(driver.driver_points) || 0,
      Number(driver.yearly_points) || 0,
      Number(driver.monthly_points) || 0,
      schedulePointsSum
    );
    const monthlyPoints = Math.max(Number(driver.monthly_points) || 0, totalDriverPoints);
    const yearlyPoints = Math.max(Number(driver.yearly_points) || 0, totalDriverPoints);
    const totalTripsCompleted = Math.max(
      Number(driver.total_trips) || 0,
      driverSchedules.reduce((sum, sc) => sum + (Number(sc.total_trips) || Number(sc.daily_trips) || 0), 0)
    );

    return {
      ...driver,
      organization_name: driverOrg,
      has_logged_in: Boolean(driver.has_logged_in),
      driver_code: driver.driver_code || `DRV-${100 + Number(driver.id)}`,
      name: userObj ? userObj.name : driver.name,
      email: userObj ? userObj.email : driver.email,
      avatar_url:
        driver.avatar_url ||
        (userObj && userObj.avatar_url) ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(driver.name || 'Driver')}`,
      license_photo_url: cleanUploadedLicenseUrl(driver.license_photo_url),
      rating: feedbackStats.rating,
      feedback_count: feedbackStats.feedbackCount,
      feedbacks: feedbackStats.feedbacks,
      routePassengers,
      schedules: driverSchedules,
      driverNotifications,
      dailyPoints: totalDriverPoints,
      driverPoints: totalDriverPoints,
      monthlyPoints,
      yearlyPoints,
      totalTripsCompleted,
      lastPointsEarned: Number(activeSchedule?.last_points_earned) || 0,
      delayMinutes: Number(activeSchedule?.delay_minutes) || 0,
      delayNotifiedForTrip: Boolean(activeSchedule?.admin_delay_notified_for_trip),
      offRouteNotifiedForTrip: Boolean(activeSchedule?.admin_offroute_notified_for_trip),
      emergencyStoppedNotifiedForTrip: Boolean(activeSchedule?.admin_emergency_stopped_notified_for_trip),
      driverArrived: Boolean(activeSchedule?.driver_arrived),
      dailyTripsCompleted: totalTripsCompleted,
      assignedShuttle: assignedShuttle
        ? {
            ...assignedShuttle,
            is_on_trip: assignedShuttle.status === 'on_trip',
            is_scheduled_time_now: Boolean(schedCtx?.isScheduledTimeNow),
            schedule_departure_time: activeSchedule?.departure_time || null,
            schedule_arrival_time: activeSchedule?.arrival_time || null,
            route: activeRoute,
            stops,
            delayNotifiedForTrip: Boolean(activeSchedule?.admin_delay_notified_for_trip),
            offRouteNotifiedForTrip: Boolean(activeSchedule?.admin_offroute_notified_for_trip),
            emergencyStoppedNotifiedForTrip: Boolean(activeSchedule?.admin_emergency_stopped_notified_for_trip),
            driverArrived: Boolean(activeSchedule?.driver_arrived),
            actualArrivalTime: activeSchedule?.actual_arrival_time || null
          }
        : null
    };
  },

  updateUserAvatar: async (userId, avatarUrl) => {
    const uIdx = store.users.findIndex((u) => u.id === Number(userId));
    if (uIdx !== -1) {
      store.users[uIdx].avatar_url = avatarUrl;
    }
    const dIdx = store.drivers.findIndex((d) => d.user_id === Number(userId));
    if (dIdx !== -1) {
      store.drivers[dIdx].avatar_url = avatarUrl;
    }
    if (isPostgresConnected && pool) {
      try {
        await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, Number(userId)]);
      } catch (_) {}
    }
    const user = store.users.find((u) => u.id === Number(userId));
    if (!user) return null;
    if (user.role === 'user') return formatPassengerRecord(user);
    const { password_hash, ...safeUser } = user;
    return safeUser;
  },

  updateUserProfile: async (userId, profileData = {}) => {
    const uIdx = store.users.findIndex((u) => u.id === Number(userId));
    if (uIdx === -1) return null;

    const current = store.users[uIdx];
    const updatedName = profileData.name !== undefined ? String(profileData.name).trim() || current.name : current.name;
    const updatedPhone = profileData.phone !== undefined ? String(profileData.phone).trim() : current.phone || '';
    const updatedBus = profileData.bus_number !== undefined
      ? String(profileData.bus_number).trim().toUpperCase() || current.bus_number
      : current.bus_number;
    const updatedAvatar = profileData.avatar_url !== undefined ? profileData.avatar_url : current.avatar_url;
    const updatedOrg = profileData.organization_name !== undefined
      ? String(profileData.organization_name).trim() || current.organization_name
      : current.organization_name;

    store.users[uIdx] = {
      ...current,
      name: updatedName,
      phone: updatedPhone,
      bus_number: updatedBus,
      avatar_url: updatedAvatar,
      organization_name: updatedOrg
    };

    store.driver_feedbacks.forEach((f) => {
      if (Number(f.passenger_id) === Number(userId)) {
        f.passenger_name = updatedName;
        f.passenger_avatar = updatedAvatar;
      }
    });

    if (isPostgresConnected && pool) {
      try {
        await pool.query(
          `UPDATE users SET name = $1, phone = $2, bus_number = $3, avatar_url = $4, organization_name = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
          [updatedName, updatedPhone, updatedBus, updatedAvatar || '', updatedOrg || '', Number(userId)]
        );
        await pool.query(
          `UPDATE driver_feedbacks SET passenger_name = $1 WHERE passenger_id = $2`,
          [updatedName, Number(userId)]
        );
      } catch (_) {}
    }

    if (store.users[uIdx].role === 'user') {
      return formatPassengerRecord(store.users[uIdx]);
    }
    const { password_hash, ...safeUser } = store.users[uIdx];
    return safeUser;
  },

  updateDriverAvatar: async (userId, avatarUrl) => {
    const uIdx = store.users.findIndex((u) => u.id === Number(userId));
    if (uIdx !== -1) {
      store.users[uIdx].avatar_url = avatarUrl;
    }
    const dIdx = store.drivers.findIndex((d) => d.user_id === Number(userId));
    if (dIdx !== -1) {
      store.drivers[dIdx].avatar_url = avatarUrl;
    }
    if (isPostgresConnected && pool) {
      try {
        await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, Number(userId)]);
        await pool.query('UPDATE drivers SET avatar_url = $1 WHERE user_id = $2', [avatarUrl, Number(userId)]);
      } catch (_) {}
    }
    return await db.getDriverByUserId(userId);
  },

  submitDriverFeedback: async ({
    passengerId,
    passengerName,
    driverId,
    shuttleId,
    rating,
    description,
    performanceType
  }) => {
    const monthKey = new Date().toISOString().slice(0, 7);
    const formattedDate = formatDateAndMonth(new Date());
    const sId = shuttleId ? Number(shuttleId) : 1;
    const shuttle = store.shuttles.find((s) => Number(s.id) === sId) || store.shuttles[0];
    const driver =
      (driverId ? store.drivers.find((d) => Number(d.id) === Number(driverId)) : null) ||
      resolveDriverForShuttle(shuttle) ||
      store.drivers[0];

    if (!driver) {
      return { error: 'Assigned driver not found for this shuttle.' };
    }

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const existingWithin30Days = store.driver_feedbacks.find((f) => {
      const samePassenger =
        (passengerId && Number(f.passenger_id) === Number(passengerId)) ||
        (passengerName &&
          f.passenger_name &&
          String(f.passenger_name).trim().toLowerCase() === String(passengerName).trim().toLowerCase());
      if (!samePassenger || Number(f.driver_id) !== Number(driver.id)) {
        return false;
      }
      const createdTime = f.created_at ? new Date(f.created_at).getTime() : 0;
      return createdTime > 0 && nowMs - createdTime < thirtyDaysMs;
    });

    if (existingWithin30Days) {
      const createdTime = new Date(existingWithin30Days.created_at).getTime();
      const daysRemaining = Math.max(
        1,
        Math.ceil((thirtyDaysMs - (nowMs - createdTime)) / (24 * 60 * 60 * 1000))
      );
      return {
        alreadySubmittedThisMonth: true,
        daysRemaining,
        existingFeedback: existingWithin30Days
      };
    }

    const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));
    const perfLabel =
      performanceType || (numericRating >= 4 ? 'Good Performance' : 'Bad Performance');
    const cleanDesc = (description || '').trim() || `${perfLabel} reported by passenger.`;
    let newFeedback = {
      id: store.driver_feedbacks.length
        ? Math.max(...store.driver_feedbacks.map((f) => Number(f.id) || 0)) + 1
        : 1,
      driver_id: driver.id,
      shuttle_id: shuttle ? shuttle.id : sId,
      shuttle_code: shuttle ? shuttle.code : `S0${sId}`,
      passenger_id: Number(passengerId),
      passenger_name: passengerName || 'Verified Passenger',
      rating: numericRating,
      performance_type: perfLabel,
      description: cleanDesc,
      month_key: monthKey,
      formatted_date: formattedDate,
      created_at: new Date().toISOString()
    };

    if (isPostgresConnected && pool) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO driver_feedbacks (driver_id, shuttle_id, shuttle_code, passenger_id, passenger_name, rating, description, month_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            newFeedback.driver_id,
            newFeedback.shuttle_id,
            newFeedback.shuttle_code,
            newFeedback.passenger_id,
            newFeedback.passenger_name,
            newFeedback.rating,
            newFeedback.description,
            newFeedback.month_key
          ]
        );
        if (rows.length > 0) {
          newFeedback = {
            ...newFeedback,
            ...rows[0],
            rating: Number(rows[0].rating) || numericRating,
            formatted_date: formattedDate,
            performance_type: perfLabel
          };
        }
      } catch (_) {}
    }

    store.driver_feedbacks.unshift(newFeedback);

    const stats = computeDriverFeedbackStats(driver.id, driver.rating);
    driver.rating = stats.rating;
    if (isPostgresConnected && pool) {
      try {
        await pool.query('UPDATE drivers SET rating = $1 WHERE id = $2', [stats.rating, driver.id]);
      } catch (_) {}
    }

    const notification = await db.createNotification({
      title: `Driver Feedback (${perfLabel} • ${formattedDate}): ${driver.name}`,
      message: `[${formattedDate}] Passenger ${newFeedback.passenger_name} (Bus ${newFeedback.shuttle_code}) rated ${driver.name} (${numericRating}/5 ★ — ${perfLabel}): "${cleanDesc}". Updated Average Rating: ${stats.rating} ★ (${stats.feedbackCount} rating${stats.feedbackCount === 1 ? '' : 's'})`,
      type: 'feedback',
      shuttle_id: newFeedback.shuttle_id
    });

    return {
      alreadySubmittedThisMonth: false,
      feedback: newFeedback,
      feedbacks: stats.feedbacks,
      updatedRating: stats.rating,
      feedbackCount: stats.feedbackCount,
      driverId: driver.id,
      driverUserId: driver.user_id,
      shuttleId: newFeedback.shuttle_id,
      notification
    };
  },

  createDriver: async (driverData) => {
    const normalizedEmail = (driverData.email || '').trim().toLowerCase();
    const rawPassword = driverData.password || `Shuttle@${Math.floor(1000 + Math.random() * 9000)}`;
    const password_hash = await bcrypt.hash(rawPassword, 10);
    const orgName = String(
      driverData.organization_name || store.settings.organization_name || 'Sairam Engineering College'
    ).trim();

    let existingUser = store.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!existingUser) {
      existingUser = {
        id: store.users.length ? Math.max(...store.users.map((u) => u.id)) + 1 : 1,
        name: driverData.name,
        email: normalizedEmail,
        password_hash,
        plain_password: rawPassword,
        role: 'driver',
        organization_name: orgName,
        phone: driverData.phone || '',
        is_active: true,
        avatar_url:
          driverData.avatar_url ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(driverData.name)}`,
        created_at: new Date().toISOString()
      };

      if (isPostgresConnected && pool) {
        try {
          const { rows } = await pool.query(
            `INSERT INTO users (name, email, password_hash, plain_password, role, phone, avatar_url, is_active, organization_name)
             VALUES ($1, $2, $3, $4, 'driver', $5, $6, true, $7)
             ON CONFLICT (email) DO UPDATE
               SET name = EXCLUDED.name,
                   password_hash = EXCLUDED.password_hash,
                   plain_password = EXCLUDED.plain_password,
                   role = 'driver',
                   is_active = true,
                   organization_name = EXCLUDED.organization_name
             RETURNING *`,
            [
              existingUser.name,
              existingUser.email,
              existingUser.password_hash,
              rawPassword,
              existingUser.phone,
              existingUser.avatar_url,
              orgName
            ]
          );
          if (rows.length > 0) existingUser = { ...existingUser, ...rows[0] };
        } catch (err) {
          console.warn('Postgres createDriver user sync warning:', err.message);
        }
      }
      store.users.push(existingUser);
    } else {
      existingUser.name = driverData.name || existingUser.name;
      existingUser.role = 'driver';
      existingUser.organization_name = orgName;
      existingUser.password_hash = password_hash;
      existingUser.plain_password = rawPassword;
      existingUser.is_active = true;
      if (isPostgresConnected && pool) {
        try {
          await pool.query(
            `UPDATE users SET name = $1, role = 'driver', password_hash = $2, plain_password = $3, is_active = true, organization_name = $4 WHERE id = $5`,
            [existingUser.name, password_hash, rawPassword, orgName, existingUser.id]
          );
        } catch (_) {}
      }
    }

    const assignedShuttleId = driverData.assigned_shuttle_id
      ? Number(driverData.assigned_shuttle_id)
      : null;

    let existingDriver = store.drivers.find((d) => d.user_id === existingUser.id);
    if (existingDriver) {
      existingDriver.name = driverData.name || existingDriver.name;
      existingDriver.email = normalizedEmail;
      existingDriver.organization_name = orgName;
      existingDriver.experience_years = Number(driverData.experience_years) || existingDriver.experience_years || 3;
      existingDriver.assigned_shuttle_id = assignedShuttleId || existingDriver.assigned_shuttle_id;
      existingDriver.plain_password = rawPassword;
      existingDriver.is_active = true;
      existingDriver.has_logged_in = false;
      existingDriver.status = 'available';
      if (driverData.license_photo_url) {
        existingDriver.license_photo_url = cleanUploadedLicenseUrl(driverData.license_photo_url);
      }
      if (isPostgresConnected && pool) {
        try {
          await pool.query(
            `UPDATE drivers SET experience_years = $1, assigned_shuttle_id = $2, plain_password = $3, is_active = true, has_logged_in = false, status = 'available', license_photo_url = $4, organization_name = $5 WHERE id = $6`,
            [
              existingDriver.experience_years,
              existingDriver.assigned_shuttle_id,
              rawPassword,
              existingDriver.license_photo_url || '',
              orgName,
              existingDriver.id
            ]
          );
        } catch (_) {}
      }
      if (existingDriver.assigned_shuttle_id) {
        const sht = store.shuttles.find((s) => Number(s.id) === Number(existingDriver.assigned_shuttle_id));
        if (sht) {
          sht.current_driver_id = existingUser.id;
          if (isPostgresConnected && pool) {
            try {
              await pool.query('UPDATE shuttles SET current_driver_id = $1 WHERE id = $2', [existingUser.id, sht.id]);
            } catch (_) {}
          }
        }
      }
      return existingDriver;
    }

    const licenseNumber =
      driverData.license_number || `DL-${Math.floor(1000000 + Math.random() * 9000000)}`;
    const nextDriverId = store.drivers.length ? Math.max(...store.drivers.map((d) => d.id)) + 1 : 1;

    // IMPORTANT: has_logged_in starts as FALSE when Admin creates a driver account!
    // It becomes TRUE only when the driver logs in for the first time via POST /api/auth/login.
    const newDriver = {
      id: nextDriverId,
      driver_code: `DRV-${100 + nextDriverId}`,
      user_id: existingUser.id,
      name: driverData.name,
      email: normalizedEmail,
      organization_name: orgName,
      phone: driverData.phone || '+91 98765 43210',
      license_number: licenseNumber,
      experience_years: Number(driverData.experience_years) || 4,
      status: 'available',
      rating: Number(driverData.rating) || 5.0,
      assigned_shuttle_id: assignedShuttleId,
      plain_password: rawPassword,
      is_active: true,
      has_logged_in: false,
      avatar_url: existingUser.avatar_url,
      license_photo_url: cleanUploadedLicenseUrl(driverData.license_photo_url),
      total_trips: 0,
      driver_points: 0,
      monthly_points: 0,
      yearly_points: 0,
      created_at: new Date().toISOString()
    };

    if (isPostgresConnected && pool) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO drivers (user_id, license_number, experience_years, status, rating, phone, assigned_shuttle_id, plain_password, is_active, has_logged_in, license_photo_url, avatar_url, organization_name, driver_points, monthly_points, yearly_points, total_trips)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false, $9, $10, $11, 0, 0, 0, 0)
           ON CONFLICT (license_number) DO UPDATE
             SET user_id = EXCLUDED.user_id,
                 experience_years = EXCLUDED.experience_years,
                 assigned_shuttle_id = EXCLUDED.assigned_shuttle_id,
                 plain_password = EXCLUDED.plain_password,
                 has_logged_in = FALSE,
                 license_photo_url = EXCLUDED.license_photo_url,
                 avatar_url = EXCLUDED.avatar_url,
                 organization_name = EXCLUDED.organization_name
           RETURNING *`,
          [
            existingUser.id,
            newDriver.license_number,
            newDriver.experience_years,
            newDriver.status,
            newDriver.rating,
            newDriver.phone,
            newDriver.assigned_shuttle_id,
            rawPassword,
            newDriver.license_photo_url,
            newDriver.avatar_url,
            orgName
          ]
        );
        if (rows.length > 0) {
          newDriver.id = rows[0].id;
        }
      } catch (err) {
        console.warn('Postgres createDriver sync warning:', err.message);
      }
    }

    // Link driver to the assigned shuttle if specified
    if (assignedShuttleId) {
      const sht = store.shuttles.find((s) => Number(s.id) === Number(assignedShuttleId));
      if (sht) {
        sht.current_driver_id = existingUser.id;
        if (isPostgresConnected && pool) {
          try {
            await pool.query('UPDATE shuttles SET current_driver_id = $1 WHERE id = $2', [existingUser.id, sht.id]);
          } catch (_) {}
        }
      }
    }

    store.drivers.push(newDriver);
    return newDriver;
  },

  updateDriver: async (id, updateData) => {
    const index = store.drivers.findIndex((d) => d.id === Number(id));
    if (index === -1) return null;
    const drv = store.drivers[index];

    const updated = {
      ...drv,
      ...updateData
    };
    store.drivers[index] = updated;

    if (updateData.avatar_url) {
      const usr = store.users.find((u) => u.id === drv.user_id);
      if (usr) usr.avatar_url = updateData.avatar_url;
    }

    // Sync active status to user login permission when Admin clicks Activate / Deactivate
    if (updateData.is_active !== undefined) {
      const shouldBeActive = Boolean(updateData.is_active);
      updated.status = shouldBeActive ? 'on_duty' : 'inactive';
      const usr = store.users.find((u) => u.id === drv.user_id);
      if (usr) usr.is_active = shouldBeActive;

      if (isPostgresConnected && pool) {
        try {
          await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [shouldBeActive, drv.user_id]);
        } catch (_) {}
      }
    }

    // If assigned_shuttle_id was updated, link driver to that shuttle
    if (updateData.assigned_shuttle_id !== undefined && updateData.assigned_shuttle_id) {
      const sht = store.shuttles.find((s) => s.id === Number(updateData.assigned_shuttle_id));
      if (sht) {
        sht.current_driver_id = drv.user_id;
        if (isPostgresConnected && pool) {
          try {
            await pool.query('UPDATE shuttles SET current_driver_id = $1 WHERE id = $2', [
              drv.user_id,
              sht.id
            ]);
          } catch (_) {}
        }
      }
    }

    if (isPostgresConnected && pool) {
      try {
        await pool.query(
          `UPDATE drivers
           SET license_photo_url = $1, is_active = $2, status = $3, experience_years = $4, assigned_shuttle_id = $5, avatar_url = $6
           WHERE id = $7`,
          [
            updated.license_photo_url || '',
            updated.is_active !== false,
            updated.status || 'available',
            Number(updated.experience_years) || 3,
            updated.assigned_shuttle_id || null,
            updated.avatar_url || '',
            Number(id)
          ]
        );
      } catch (_) {}
    }

    return updated;
  },

  deleteDriver: async (id) => {
    const index = store.drivers.findIndex((d) => d.id === Number(id));
    if (index === -1) return false;

    const drv = store.drivers[index];
    const driverUserId = drv.user_id;

    store.shuttles.forEach((s) => {
      if (s.current_driver_id === driverUserId || s.id === drv.assigned_shuttle_id) {
        s.current_driver_id = null;
      }
    });

    if (isPostgresConnected && pool) {
      try {
        if (driverUserId) {
          await pool.query('UPDATE shuttles SET current_driver_id = NULL WHERE current_driver_id = $1', [
            driverUserId
          ]);
        }
        await pool.query('DELETE FROM drivers WHERE id = $1', [Number(id)]);
        if (driverUserId) {
          await pool.query("DELETE FROM users WHERE id = $1 AND role = 'driver'", [driverUserId]);
        }
      } catch (err) {
        console.warn('Postgres deleteDriver warning:', err.message);
      }
    }

    store.drivers.splice(index, 1);
    if (driverUserId) {
      const uIdx = store.users.findIndex((u) => u.id === driverUserId);
      if (uIdx !== -1) store.users.splice(uIdx, 1);
    }
    return true;
  },

  // Routes & Stops
  recalculateRouteMetrics: async (routeId) => {
    const rId = Number(routeId);
    const route = store.routes.find((r) => Number(r.id) === rId);
    if (!route) return null;
    let stops = store.stops
      .filter((s) => Number(s.route_id) === rId)
      .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1));

    // Order intermediate stops (between Start #1 and Destination #N) along the SHORTEST continuous path
    if (stops.length >= 3) {
      const startStop = stops[0];
      const destStop = stops[stops.length - 1];
      const intermediates = stops.slice(1, -1);

      const orderedIntermediates = [];
      const remaining = [...intermediates];
      let curr = startStop;
      while (remaining.length > 0) {
        let bestIdx = 0;
        let bestCost = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const cand = remaining[i];
          const dFromCurr = calculateDistanceKm(
            Number(curr.latitude),
            Number(curr.longitude),
            Number(cand.latitude),
            Number(cand.longitude)
          );
          const dToDest = calculateDistanceKm(
            Number(cand.latitude),
            Number(cand.longitude),
            Number(destStop.latitude),
            Number(destStop.longitude)
          );
          const cost = dFromCurr + dToDest * 0.35;
          if (cost < bestCost) {
            bestCost = cost;
            bestIdx = i;
          }
        }
        curr = remaining.splice(bestIdx, 1)[0];
        orderedIntermediates.push(curr);
      }

      const finalOrdered = [startStop, ...orderedIntermediates, destStop];
      // 2-opt refinement on intermediate stops to guarantee shortest total distance Start -> ... -> Dest
      if (finalOrdered.length >= 4) {
        let improved = true;
        let guard = 0;
        while (improved && guard < 25) {
          improved = false;
          guard++;
          for (let i = 1; i < finalOrdered.length - 2; i++) {
            for (let j = i + 1; j < finalOrdered.length - 1; j++) {
              const a = finalOrdered[i - 1];
              const b = finalOrdered[i];
              const c = finalOrdered[j];
              const d = finalOrdered[j + 1];
              const curDist =
                calculateDistanceKm(Number(a.latitude), Number(a.longitude), Number(b.latitude), Number(b.longitude)) +
                calculateDistanceKm(Number(c.latitude), Number(c.longitude), Number(d.latitude), Number(d.longitude));
              const swappedDist =
                calculateDistanceKm(Number(a.latitude), Number(a.longitude), Number(c.latitude), Number(c.longitude)) +
                calculateDistanceKm(Number(b.latitude), Number(b.longitude), Number(d.latitude), Number(d.longitude));
              if (swappedDist + 0.02 < curDist) {
                const reversedSlice = finalOrdered.slice(i, j + 1).reverse();
                finalOrdered.splice(i, j - i + 1, ...reversedSlice);
                improved = true;
              }
            }
          }
        }
      }

      for (let i = 0; i < finalOrdered.length; i++) {
        if (finalOrdered[i].sequence_order !== i + 1) {
          finalOrdered[i].sequence_order = i + 1;
          if (isPostgresConnected && pool && finalOrdered[i].id) {
            try {
              await pool.query('UPDATE stops SET sequence_order = $1 WHERE id = $2', [
                i + 1,
                finalOrdered[i].id
              ]);
            } catch (_) {}
          }
        }
      }
      stops = finalOrdered;
    }

    if (stops.length >= 2) {
      let straightSumKm = 0;
      const validCoords = [];
      const legStraightKm = [0];
      for (let i = 0; i < stops.length; i++) {
        const lat = Number(stops[i].latitude);
        const lng = Number(stops[i].longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          validCoords.push({ lat, lng });
        }
        if (i < stops.length - 1) {
          const lat2 = Number(stops[i + 1].latitude);
          const lng2 = Number(stops[i + 1].longitude);
          if (!isNaN(lat) && !isNaN(lng) && !isNaN(lat2) && !isNaN(lng2)) {
            const legDist = calculateDistanceKm(lat, lng, lat2, lng2);
            straightSumKm += legDist;
            legStraightKm.push(straightSumKm);
          } else {
            legStraightKm.push(straightSumKm);
          }
        }
      }

      // Exact road-factor distance & 30 km/h ETA calculation
      let totalRoadKm = Number(Math.max(0.5, straightSumKm * 1.24).toFixed(2));
      let estMinutes = Math.max(2, Math.round((totalRoadKm / 30) * 60));

      // Query OSRM multi-stop road routing via native fetch for exact road distance across all stops in sequence
      if (validCoords.length >= 2) {
        try {
          const coordString = validCoords.map((c) => `${c.lng.toFixed(5)},${c.lat.toFixed(5)}`).join(';');
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=false`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3800);
          const res = await fetch(osrmUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (res.ok) {
            const osrmData = await res.json();
            const osrmRoute = osrmData?.routes?.[0];
            if (osrmRoute && Number(osrmRoute.distance) > 50) {
              totalRoadKm = Number((Number(osrmRoute.distance) / 1000).toFixed(2));
              estMinutes = Math.max(2, Math.round((totalRoadKm / 30) * 60));

              // If OSRM returned per-leg road distances, assign exact leg_km, cumulative_km, and 30 km/h ETA to each stop
              if (Array.isArray(osrmRoute.legs) && osrmRoute.legs.length === stops.length - 1) {
                let cumKm = 0;
                stops[0].leg_km = 0;
                stops[0].cumulative_km = 0;
                stops[0].eta_minutesFromStart = 0;
                for (let k = 0; k < osrmRoute.legs.length; k++) {
                  const legKm = Number(((Number(osrmRoute.legs[k].distance) || 0) / 1000).toFixed(2));
                  cumKm = Number((cumKm + legKm).toFixed(2));
                  stops[k + 1].leg_km = legKm;
                  stops[k + 1].cumulative_km = cumKm;
                  stops[k + 1].eta_minutesFromStart = Math.max(k + 1, Math.round((cumKm / 30) * 60));
                }
              }
            }
          }
        } catch (_) {
          // Keep road-factor calculation if OSRM is temporarily unreachable
        }
      }

      // Ensure every stop has exact cumulative_km and monotonic eta_minutesFromStart at 30 km/h
      for (let i = 0; i < stops.length; i++) {
        if (i === 0) {
          stops[i].leg_km = 0;
          stops[i].cumulative_km = 0;
          stops[i].eta_minutesFromStart = 0;
        } else if (!stops[i].eta_minutesFromStart || stops[i].eta_minutesFromStart <= stops[i - 1].eta_minutesFromStart) {
          const frac = straightSumKm > 0 ? (legStraightKm[i] || 0) / straightSumKm : i / (stops.length - 1);
          const cumKm = Number((frac * totalRoadKm).toFixed(2));
          const prevCumKm = Number(stops[i - 1].cumulative_km || 0);
          stops[i].cumulative_km = cumKm;
          stops[i].leg_km = Number(Math.max(0.1, cumKm - prevCumKm).toFixed(2));
          stops[i].eta_minutesFromStart = Math.max(
            (stops[i - 1].eta_minutesFromStart || 0) + 1,
            Math.round((cumKm / 30) * 60)
          );
        }
      }

      route.distance_km = totalRoadKm;
      route.estimated_time_minutes = estMinutes;
      route.speed_kmh = 30;

      if (isPostgresConnected && pool) {
        try {
          await pool.query(
            'UPDATE routes SET distance_km = $1, estimated_time_minutes = $2 WHERE id = $3',
            [totalRoadKm, estMinutes, rId]
          );
        } catch (_) {}
      }

      const linkedShuttle = store.shuttles.find(
        (s) => Number(s.current_route_id) === rId || Number(s.id) === Number(route.shuttle_id)
      );
      if (linkedShuttle) {
        linkedShuttle.distance_km = totalRoadKm;
        linkedShuttle.eta_minutes = estMinutes;
        if (linkedShuttle.status !== 'on_trip' && stops[0]) {
          linkedShuttle.current_lat = Number(stops[0].latitude);
          linkedShuttle.current_lng = Number(stops[0].longitude);
          if (isPostgresConnected && pool) {
            try {
              await pool.query(
                'UPDATE shuttles SET current_lat = $1, current_lng = $2 WHERE id = $3',
                [linkedShuttle.current_lat, linkedShuttle.current_lng, linkedShuttle.id]
              );
            } catch (_) {}
          }
        }
      }
    }
    return route;
  },

  getAllRoutes: async (orgName = null) => {
    const filtered = orgName
      ? store.routes.filter((r) => {
          if (matchesOrg(r.organization_name, orgName)) return true;
          const sht = store.shuttles.find(
            (s) => s.id === r.shuttle_id || s.current_route_id === r.id
          );
          return sht ? matchesOrg(sht.organization_name, orgName) : false;
        })
      : store.routes;
    const routesList = filtered.length > 0 ? filtered : store.routes;

    return routesList.map((route) => {
      const stops = store.stops
        .filter((s) => s.route_id === route.id)
        .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1));
      const activeShuttles = store.shuttles.filter(
        (s) => s.current_route_id === route.id || s.id === route.shuttle_id
      );
      const primaryShuttle = activeShuttles[0] || store.shuttles.find((s) => s.id === route.shuttle_id);
      const driver = primaryShuttle ? resolveDriverForShuttle(primaryShuttle) : null;
      return {
        ...route,
        organization_name:
          route.organization_name ||
          primaryShuttle?.organization_name ||
          store.settings?.organization_name ||
          'Sathyabama Institute of Science and Technology',
        shuttle_id: route.shuttle_id || (primaryShuttle ? primaryShuttle.id : null),
        shuttle_code: primaryShuttle ? primaryShuttle.code : null,
        shuttle_name: primaryShuttle ? primaryShuttle.name : null,
        shuttle_speed: primaryShuttle && primaryShuttle.status === 'on_trip' ? primaryShuttle.speed || 24 : 0,
        shuttle_eta_minutes: primaryShuttle
          ? primaryShuttle.eta_minutes || route.estimated_time_minutes || 10
          : route.estimated_time_minutes || 10,
        shuttle_next_stop:
          primaryShuttle && primaryShuttle.status === 'on_trip'
            ? primaryShuttle.next_stop_name || stops[0]?.name
            : 'Trip Not Started',
        shuttle_status: primaryShuttle ? primaryShuttle.status : 'idle',
        driver_name: driver ? driver.name : 'No Driver Allocated',
        stop_reached_times: primaryShuttle?.stop_reached_times || {},
        traffic_delay_stop: primaryShuttle?.traffic_delay_stop || null,
        landmark: route.landmark || stops[0]?.landmark || '',
        stops,
        stops_count: stops.length,
        active_shuttles_count: activeShuttles.length
      };
    });
  },

  getRouteById: async (id) => {
    const route = store.routes.find((r) => r.id === Number(id));
    if (!route) return null;
    const stops = store.stops
      .filter((s) => s.route_id === route.id)
      .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1));
    return { ...route, stops };
  },

  createRoute: async (routeData) => {
    const startCoords = await geocodeLocation(routeData.start_point, 12.9602, 80.0569);
    const endCoords = await geocodeLocation(routeData.end_point, 12.9249, 80.1000);
    const straightDist = calculateDistanceKm(startCoords.lat, startCoords.lng, endCoords.lat, endCoords.lng);
    const computedDist =
      Number(routeData.distance_km) || Number((straightDist * 1.24).toFixed(2));
    const computedTime =
      Number(routeData.estimated_time_minutes) || Math.max(5, Math.round((computedDist / 26) * 60));

    // If this bus already has an assigned route, update that route in-place so each bus has 1 authoritative route
    const targetShuttleId = routeData.shuttle_id ? Number(routeData.shuttle_id) : null;
    const shuttleObj = targetShuttleId ? store.shuttles.find((s) => s.id === targetShuttleId) : null;
    const existingForBus = targetShuttleId
      ? store.routes.find(
          (r) =>
            Number(r.shuttle_id) === targetShuttleId ||
            (shuttleObj && Number(r.id) === Number(shuttleObj.current_route_id))
        )
      : null;

    const orgName =
      String(
        routeData.organization_name ||
          shuttleObj?.organization_name ||
          existingForBus?.organization_name ||
          store.settings?.organization_name ||
          'Sathyabama Institute of Science and Technology'
      ).trim();

    const cleanRouteLandmark = routeData.landmark ? String(routeData.landmark).trim() : '';

    let newRoute = {
      id: existingForBus
        ? existingForBus.id
        : store.routes.length
        ? Math.max(...store.routes.map((r) => r.id)) + 1
        : 1,
      code:
        routeData.code ||
        existingForBus?.code ||
        `RT-${shuttleObj ? shuttleObj.code : `0${store.routes.length + 1}`}`,
      name: routeData.name,
      description: routeData.description || `${routeData.start_point} to ${routeData.end_point}`,
      start_point: routeData.start_point,
      end_point: routeData.end_point,
      landmark: cleanRouteLandmark,
      shuttle_id: targetShuttleId,
      distance_km: computedDist,
      estimated_time_minutes: computedTime,
      color: routeData.color || '#2563EB',
      is_active: true,
      organization_name: orgName,
      created_at: existingForBus?.created_at || new Date().toISOString()
    };

    if (isPostgresConnected && pool) {
      try {
        if (existingForBus) {
          await pool.query(
            `UPDATE routes
             SET name = $1, code = $2, description = $3, start_point = $4, end_point = $5,
                 distance_km = $6, estimated_time_minutes = $7, shuttle_id = $8, landmark = $9, organization_name = $10
             WHERE id = $11`,
            [
              newRoute.name,
              newRoute.code,
              newRoute.description,
              newRoute.start_point,
              newRoute.end_point,
              newRoute.distance_km,
              newRoute.estimated_time_minutes,
              newRoute.shuttle_id,
              newRoute.landmark,
              orgName,
              newRoute.id
            ]
          );
          await pool.query('DELETE FROM stops WHERE route_id = $1', [newRoute.id]);
        } else {
          const { rows } = await pool.query(
            `INSERT INTO routes (name, code, description, start_point, end_point, distance_km, estimated_time_minutes, color, is_active, shuttle_id, landmark, organization_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11)
             ON CONFLICT (code) DO UPDATE
               SET name = EXCLUDED.name,
                   start_point = EXCLUDED.start_point,
                   end_point = EXCLUDED.end_point,
                   distance_km = EXCLUDED.distance_km,
                   estimated_time_minutes = EXCLUDED.estimated_time_minutes,
                   shuttle_id = EXCLUDED.shuttle_id,
                   landmark = EXCLUDED.landmark,
                   organization_name = EXCLUDED.organization_name
             RETURNING *`,
            [
              newRoute.name,
              newRoute.code,
              newRoute.description,
              newRoute.start_point,
              newRoute.end_point,
              newRoute.distance_km,
              newRoute.estimated_time_minutes,
              newRoute.color,
              newRoute.shuttle_id,
              newRoute.landmark,
              orgName
            ]
          );
          if (rows.length > 0) newRoute = { ...newRoute, ...rows[0], organization_name: orgName };
        }
      } catch (err) {
        console.warn('Postgres createRoute sync warning:', err.message);
      }
    }

    // Preserve any existing intermediate stops if updating an existing bus route AND start/end haven't moved to a new city
    const previousRouteStops = existingForBus
      ? store.stops
          .filter((s) => Number(s.route_id) === Number(existingForBus.id))
          .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1))
      : [];
    const sameEndpoints =
      existingForBus &&
      String(existingForBus.start_point || '').trim().toLowerCase() ===
        String(routeData.start_point || '').trim().toLowerCase() &&
      String(existingForBus.end_point || '').trim().toLowerCase() ===
        String(routeData.end_point || '').trim().toLowerCase();
    const preservedIntermediateStops =
      sameEndpoints && previousRouteStops.length > 2
        ? previousRouteStops.slice(1, previousRouteStops.length - 1)
        : [];

    const existingRouteIdx = store.routes.findIndex((r) => r.id === newRoute.id);
    if (existingRouteIdx !== -1) {
      store.routes[existingRouteIdx] = newRoute;
      store.stops = store.stops.filter((s) => s.route_id !== newRoute.id);
    } else {
      store.routes.push(newRoute);
    }

    // Build stops: Start Stop (#1) -> Preserved/Custom Intermediate Stops -> Destination Stop (Final)
    const stopsToCreate =
      Array.isArray(routeData.stops) && routeData.stops.length > 0
        ? routeData.stops
        : [
            {
              name: routeData.start_point,
              latitude: startCoords.lat,
              longitude: startCoords.lng,
              landmark: cleanRouteLandmark || 'Starting Point'
            },
            ...preservedIntermediateStops.map((mid) => ({
              name: mid.name,
              latitude: mid.latitude,
              longitude: mid.longitude,
              landmark: mid.landmark || ''
            })),
            {
              name: routeData.end_point,
              latitude: endCoords.lat,
              longitude: endCoords.lng,
              landmark: 'Destination Terminal'
            }
          ];

    for (let idx = 0; idx < stopsToCreate.length; idx++) {
      const st = stopsToCreate[idx];
      const fraction = stopsToCreate.length > 1 ? idx / (stopsToCreate.length - 1) : 0.5;
      const coords =
        st.latitude && st.longitude
          ? { lat: Number(st.latitude), lng: Number(st.longitude) }
          : await geocodeLocation(st.name, startCoords.lat, startCoords.lng, {
              startLat: startCoords.lat,
              startLng: startCoords.lng,
              endLat: endCoords.lat,
              endLng: endCoords.lng,
              fraction
            });
      await db.addStop({
        route_id: newRoute.id,
        name: st.name,
        sequence_order: idx + 1,
        latitude: coords.lat,
        longitude: coords.lng,
        landmark: st.landmark || ''
      });
    }

    await db.recalculateRouteMetrics(newRoute.id);

    // Link route to the selected shuttle and schedules so Driver and Passenger views immediately see it
    if (newRoute.shuttle_id) {
      await db.updateShuttle(newRoute.shuttle_id, {
        current_route_id: newRoute.id,
        start_point: newRoute.start_point,
        destination: newRoute.end_point,
        current_lat: startCoords.lat,
        current_lng: startCoords.lng
      });
      store.schedules.forEach((sched) => {
        if (Number(sched.shuttle_id) === Number(newRoute.shuttle_id)) {
          sched.route_id = newRoute.id;
          sched.route_name = newRoute.name;
        }
      });
    }

    return db.getRouteById(newRoute.id);
  },

  updateRoute: async (id, updateData) => {
    const index = store.routes.findIndex((r) => r.id === Number(id));
    if (index === -1) return null;
    store.routes[index] = { ...store.routes[index], ...updateData };
    const updated = store.routes[index];

    const startCoords = await geocodeLocation(updated.start_point, 12.9602, 80.0569);
    const endCoords = await geocodeLocation(updated.end_point, 12.9249, 80.1000);

    // Sync stops of this route so Stop #1 is start_point and the Final Stop is end_point (Destination)
    const routeStops = store.stops
      .filter((st) => st.route_id === updated.id)
      .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1));

    if (routeStops.length > 0 && updateData.start_point !== undefined) {
      routeStops[0].name = updated.start_point;
      routeStops[0].latitude = startCoords.lat;
      routeStops[0].longitude = startCoords.lng;
    }
    if (routeStops.length > 1 && updateData.end_point !== undefined) {
      const lastStop = routeStops[routeStops.length - 1];
      lastStop.name = updated.end_point;
      lastStop.latitude = endCoords.lat;
      lastStop.longitude = endCoords.lng;
    }

    // Re-validate any intermediate stops if start or end changed
    if (routeStops.length > 2 && (updateData.start_point !== undefined || updateData.end_point !== undefined)) {
      for (let i = 1; i < routeStops.length - 1; i++) {
        const midStop = routeStops[i];
        const fraction = i / (routeStops.length - 1);
        const fixed = await geocodeLocation(midStop.name, startCoords.lat, startCoords.lng, {
          startLat: startCoords.lat,
          startLng: startCoords.lng,
          endLat: endCoords.lat,
          endLng: endCoords.lng,
          fraction
        });
        midStop.latitude = fixed.lat;
        midStop.longitude = fixed.lng;
      }
    }

    for (let idx = 0; idx < routeStops.length; idx++) {
      routeStops[idx].sequence_order = idx + 1;
      if (isPostgresConnected && pool) {
        try {
          await pool.query(
            'UPDATE stops SET name = $1, latitude = $2, longitude = $3, sequence_order = $4 WHERE id = $5',
            [
              routeStops[idx].name,
              routeStops[idx].latitude,
              routeStops[idx].longitude,
              routeStops[idx].sequence_order,
              routeStops[idx].id
            ]
          );
        } catch (_) {}
      }
    }

    if (updateData.distance_km !== undefined && Number(updateData.distance_km) > 0) {
      updated.distance_km = Number(Number(updateData.distance_km).toFixed(2));
      updated.estimated_time_minutes =
        Number(updateData.estimated_time_minutes) ||
        Math.max(4, Math.round((updated.distance_km / 26) * 60));
    } else {
      await db.recalculateRouteMetrics(updated.id);
    }

    if (isPostgresConnected && pool) {
      try {
        await pool.query(
          `UPDATE routes
           SET name = $1, code = $2, start_point = $3, end_point = $4, landmark = $5,
               distance_km = $6, estimated_time_minutes = $7, shuttle_id = $8
           WHERE id = $9`,
          [
            updated.name,
            updated.code,
            updated.start_point,
            updated.end_point,
            updated.landmark || '',
            Number(updated.distance_km) || 4.0,
            Number(updated.estimated_time_minutes) || 15,
            updated.shuttle_id ? Number(updated.shuttle_id) : null,
            Number(id)
          ]
        );
      } catch (_) {}
    }

    if (updated.shuttle_id) {
      await db.updateShuttle(updated.shuttle_id, {
        current_route_id: updated.id,
        start_point: updated.start_point,
        destination: updated.end_point,
        distance_km: updated.distance_km,
        eta_minutes: updated.estimated_time_minutes,
        ...(updateData.start_point !== undefined
          ? { current_lat: startCoords.lat, current_lng: startCoords.lng }
          : {})
      });
    }

    return db.getRouteById(id);
  },

  deleteRoute: async (id) => {
    const rId = Number(id);
    const index = store.routes.findIndex((r) => Number(r.id) === rId);
    if (index === -1) return false;
    const targetRoute = store.routes[index];
    if (isPostgresConnected && pool) {
      try {
        await pool.query('DELETE FROM stops WHERE route_id = $1', [rId]);
        await pool.query('UPDATE shuttles SET current_route_id = NULL WHERE current_route_id = $1', [rId]);
        await pool.query('DELETE FROM routes WHERE id = $1', [rId]);
      } catch (_) {}
    }
    store.routes.splice(index, 1);
    store.stops = store.stops.filter((s) => Number(s.route_id) !== rId);
    store.shuttles.forEach((s) => {
      if (Number(s.current_route_id) === rId || Number(s.id) === Number(targetRoute?.shuttle_id)) {
        if (Number(s.current_route_id) === rId) {
          s.current_route_id = null;
        }
      }
    });
    return true;
  },

  // Stops
  getStopsByRoute: async (routeId) => {
    return store.stops
      .filter((s) => s.route_id === Number(routeId))
      .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1));
  },
  getAllStops: async () => {
    return store.stops;
  },
  addStop: async (stopData) => {
    const routeId = Number(stopData.route_id);
    const parentRoute = store.routes.find((r) => Number(r.id) === routeId);
    let existingStops = store.stops
      .filter((s) => Number(s.route_id) === routeId)
      .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1));

    // If adding an intermediate stop to a route that doesn't yet have its Start & Destination stops initialized,
    // automatically initialize Stop #1 (Start) and Stop #2 (Destination) first
    if (!stopData.sequence_order && existingStops.length < 2 && parentRoute && parentRoute.start_point && parentRoute.end_point) {
      const sCoords = await geocodeLocation(parentRoute.start_point, 12.9602, 80.0569);
      const eCoords = await geocodeLocation(parentRoute.end_point, 12.9249, 80.1000);
      if (existingStops.length === 0) {
        const s1 = {
          id: store.stops.length ? Math.max(...store.stops.map((s) => s.id)) + 1 : 1,
          route_id: routeId,
          name: parentRoute.start_point,
          sequence_order: 1,
          latitude: sCoords.lat,
          longitude: sCoords.lng,
          landmark: parentRoute.landmark || 'Starting Point'
        };
        store.stops.push(s1);
        const s2 = {
          id: store.stops.length ? Math.max(...store.stops.map((s) => s.id)) + 1 : 2,
          route_id: routeId,
          name: parentRoute.end_point,
          sequence_order: 2,
          latitude: eCoords.lat,
          longitude: eCoords.lng,
          landmark: 'Destination Terminal'
        };
        store.stops.push(s2);
      }
      existingStops = store.stops
        .filter((s) => Number(s.route_id) === routeId)
        .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1));
    }

    const startLat = Number(existingStops[0]?.latitude) || 12.9602;
    const startLng = Number(existingStops[0]?.longitude) || 80.0569;
    const endLat =
      existingStops.length >= 2
        ? Number(existingStops[existingStops.length - 1]?.latitude) || startLat
        : startLat + 0.03;
    const endLng =
      existingStops.length >= 2
        ? Number(existingStops[existingStops.length - 1]?.longitude) || startLng
        : startLng + 0.03;
    const fraction =
      existingStops.length >= 2
        ? Math.min(0.85, Math.max(0.2, (existingStops.length - 1) / (existingStops.length + 1)))
        : 0.5;

    const cleanName = String(stopData.name || '').trim();
    const cleanLandmark = String(stopData.landmark || '').trim();

    let coords = { lat: Number(stopData.latitude), lng: Number(stopData.longitude) };
    if (!coords.lat || !coords.lng || isNaN(coords.lat) || isNaN(coords.lng)) {
      coords = await geocodeLocation(cleanName, startLat, startLng, {
        startLat,
        startLng,
        endLat,
        endLng,
        fraction
      });
      if (
        coords.isFallback &&
        cleanLandmark &&
        cleanLandmark.toLowerCase() !== 'transit stop' &&
        cleanLandmark.toLowerCase() !== 'starting point' &&
        cleanLandmark.toLowerCase() !== 'destination terminal'
      ) {
        const landmarkCoords = await geocodeLocation(cleanLandmark, startLat, startLng, {
          startLat,
          startLng,
          endLat,
          endLng,
          fraction
        });
        if (!landmarkCoords.isFallback) {
          coords = landmarkCoords;
        }
      }
    }

    const isDestStop =
      parentRoute &&
      parentRoute.end_point &&
      cleanName.toLowerCase() === String(parentRoute.end_point).trim().toLowerCase();

    let insertSeq = Number(stopData.sequence_order) || existingStops.length + 1;
    if (!stopData.sequence_order && existingStops.length >= 2 && !isDestStop) {
      // Insert right before the final Destination stop
      insertSeq = existingStops.length;
    }

    let newStop = {
      id: store.stops.length ? Math.max(...store.stops.map((s) => s.id)) + 1 : 1,
      route_id: routeId,
      name: cleanName,
      sequence_order: insertSeq,
      latitude: coords.lat,
      longitude: coords.lng,
      landmark: cleanLandmark
    };

    if (isPostgresConnected && pool) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO stops (route_id, name, sequence_order, latitude, longitude, landmark)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            newStop.route_id,
            newStop.name,
            newStop.sequence_order,
            newStop.latitude,
            newStop.longitude,
            newStop.landmark
          ]
        );
        if (rows.length > 0) newStop = rows[0];
      } catch (err) {
        console.warn('Postgres addStop insert warning:', err.message);
      }
    }

    if (!stopData.sequence_order && existingStops.length >= 2 && !isDestStop) {
      // Keep Start (#1) first, order intermediate stops along the shortest continuous path toward Destination,
      // and keep Destination (#N) as the final stop!
      const startStop = existingStops[0];
      const finalDestStop = existingStops[existingStops.length - 1];
      const middleStops = [...existingStops.slice(1, existingStops.length - 1), newStop];

      store.stops.push(newStop);
      const finalOrdered = [startStop, ...middleStops, finalDestStop];

      // Apply 2-opt shortest path refinement on intermediate stops (keeping Start at 0 and Destination at N-1)
      if (finalOrdered.length >= 4) {
        let improved = true;
        while (improved) {
          improved = false;
          for (let i = 1; i < finalOrdered.length - 2; i++) {
            for (let j = i + 1; j < finalOrdered.length - 1; j++) {
              const a = finalOrdered[i - 1];
              const b = finalOrdered[i];
              const c = finalOrdered[j];
              const d = finalOrdered[j + 1];
              const curDist =
                calculateDistanceKm(Number(a.latitude), Number(a.longitude), Number(b.latitude), Number(b.longitude)) +
                calculateDistanceKm(Number(c.latitude), Number(c.longitude), Number(d.latitude), Number(d.longitude));
              const swappedDist =
                calculateDistanceKm(Number(a.latitude), Number(a.longitude), Number(c.latitude), Number(c.longitude)) +
                calculateDistanceKm(Number(b.latitude), Number(b.longitude), Number(d.latitude), Number(d.longitude));
              if (swappedDist + 0.05 < curDist) {
                const reversedSlice = finalOrdered.slice(i, j + 1).reverse();
                finalOrdered.splice(i, j - i + 1, ...reversedSlice);
                improved = true;
              }
            }
          }
        }
      }

      for (let i = 0; i < finalOrdered.length; i++) {
        finalOrdered[i].sequence_order = i + 1;
        if (isPostgresConnected && pool) {
          try {
            await pool.query('UPDATE stops SET sequence_order = $1 WHERE id = $2', [
              finalOrdered[i].sequence_order,
              finalOrdered[i].id
            ]);
          } catch (_) {}
        }
      }
    } else {
      store.stops.push(newStop);
    }

    await db.recalculateRouteMetrics(routeId);

    return newStop;
  },
  updateStop: async (stopId, stopData = {}) => {
    const stop = store.stops.find((s) => Number(s.id) === Number(stopId));
    if (!stop) return null;
    if (stopData.name !== undefined && String(stopData.name).trim()) {
      stop.name = String(stopData.name).trim();
    }
    if (stopData.landmark !== undefined) {
      stop.landmark = String(stopData.landmark).trim();
    }
    if (stopData.latitude !== undefined && !isNaN(Number(stopData.latitude))) {
      stop.latitude = Number(Number(stopData.latitude).toFixed(6));
    }
    if (stopData.longitude !== undefined && !isNaN(Number(stopData.longitude))) {
      stop.longitude = Number(Number(stopData.longitude).toFixed(6));
    }

    if (isPostgresConnected && pool) {
      try {
        await pool.query(
          'UPDATE stops SET name = $1, landmark = $2, latitude = $3, longitude = $4 WHERE id = $5',
          [stop.name, stop.landmark || '', stop.latitude, stop.longitude, Number(stop.id)]
        );
      } catch (err) {
        console.warn('Postgres updateStop warning:', err.message);
      }
    }

    const routeId = Number(stop.route_id);
    const parentRoute = store.routes.find((r) => Number(r.id) === routeId);
    const routeStops = store.stops
      .filter((s) => Number(s.route_id) === routeId)
      .sort((a, b) => (Number(a.sequence_order) || 1) - (Number(b.sequence_order) || 1));

    if (parentRoute && routeStops.length > 0) {
      if (Number(stop.id) === Number(routeStops[0].id)) {
        parentRoute.start_point = stop.name;
      } else if (routeStops.length > 1 && Number(stop.id) === Number(routeStops[routeStops.length - 1].id)) {
        parentRoute.end_point = stop.name;
      }
    }

    await db.recalculateRouteMetrics(routeId);
    return stop;
  },
  deleteStop: async (stopId) => {
    const idx = store.stops.findIndex((s) => s.id === Number(stopId));
    if (idx === -1) return false;
    const routeId = store.stops[idx].route_id;
    store.stops.splice(idx, 1);
    if (isPostgresConnected && pool) {
      try {
        await pool.query('DELETE FROM stops WHERE id = $1', [Number(stopId)]);
      } catch (_) {}
    }
    // Re-sequence remaining stops on that route
    const routeStops = store.stops
      .filter((s) => s.route_id === routeId)
      .sort((a, b) => a.sequence_order - b.sequence_order);
    for (let i = 0; i < routeStops.length; i++) {
      routeStops[i].sequence_order = i + 1;
      if (isPostgresConnected && pool) {
        try {
          await pool.query('UPDATE stops SET sequence_order = $1 WHERE id = $2', [
            routeStops[i].sequence_order,
            routeStops[i].id
          ]);
        } catch (_) {}
      }
    }
    await db.recalculateRouteMetrics(routeId);
    return true;
  },

  // Trips
  getAllTrips: async () => {
    return store.trips;
  },
  getActiveTrips: async () => {
    return store.trips.filter((t) => t.status === 'in_progress');
  },
  createTrip: async (tripData) => {
    const sId = Number(tripData.shuttle_id) || 1;
    const shuttle = store.shuttles.find((s) => Number(s.id) === sId) || store.shuttles[0];
    const resolvedShuttleId = shuttle ? shuttle.id : sId;

    const newTrip = {
      id: store.trips.length ? Math.max(...store.trips.map((t) => t.id)) + 1 : 100,
      status: 'in_progress',
      start_time: new Date().toISOString(),
      passenger_count: Number(tripData.passenger_count) || 12,
      delay_minutes: 0,
      ...tripData,
      shuttle_id: resolvedShuttleId
    };
    store.trips.unshift(newTrip);

    if (shuttle) {
      shuttle.status = 'on_trip';
      shuttle.speed = 0;
      shuttle.trip_id = newTrip.id;
      shuttle.stop_reached_times = {};
      shuttle.traffic_delay_stop = null;
      shuttle.admin_delay_notified_for_trip = false;
      shuttle.admin_offroute_notified_for_trip = false;
      shuttle.admin_emergency_stopped_notified_for_trip = false;
      shuttle.passenger_emergency_reports = [];
      if (isPostgresConnected && pool) {
        try {
          await pool.query("UPDATE shuttles SET status = 'on_trip', speed = 0 WHERE id = $1", [shuttle.id]);
        } catch (_) {}
      }
    }

    // Reset per-trip arrival, point, delay-notification, off-route, and emergency flags so the new trip notifies once
    // IMPORTANT: Keep cumulative driver_points, monthly_points, yearly_points, total_trips across all trips!
    store.schedules.forEach((sc) => {
      if (Number(sc.shuttle_id) === Number(resolvedShuttleId)) {
        sc.driver_arrived = false;
        sc.trip_completed_in_window = false;
        sc.point_awarded_for_trip = false;
        sc.admin_delay_notified_for_trip = false;
        sc.admin_offroute_notified_for_trip = false;
        sc.admin_emergency_stopped_notified_for_trip = false;
        sc.driver_not_started_notified = false;
        sc.passenger_emergency_reports = [];
        sc.delay_minutes = 0;
        sc.status = 'on_trip';
      }
    });

    // Notify allocated Passengers (in Passenger Login + Passenger Email) when Driver starts trip
    try {
      const driver = shuttle ? resolveDriverForShuttle(shuttle) : null;
      const driverUser = driver ? store.users.find((u) => u.id === driver.user_id) : null;
      const route = shuttle ? resolveRouteForShuttle(shuttle) : null;
      const busCode = shuttle?.code || `S0${resolvedShuttleId}`;
      const driverName =
        tripData.driver_name || (driver ? driverUser?.name || driver.name : 'Assigned Driver');
      const startPt = shuttle?.start_point || route?.start_point || 'Starting Point';
      const destPt = shuttle?.destination || route?.end_point || 'Destination';
      const routeName = route?.name || `${startPt} ➔ ${destPt}`;
      const orgName =
        shuttle?.organization_name ||
        store.settings?.organization_name ||
        'Sairam Engineering College';

      const passengerNotif = await db.createNotification({
        title: `🚍 Trip Started: Bus ${busCode} (${startPt} ➔ ${destPt})`,
        message: `Driver ${driverName} has started the trip on Bus ${busCode} (${routeName}). Live GPS tracking is now active on your Passenger Dashboard!`,
        type: 'info',
        shuttle_id: resolvedShuttleId,
        organization_name: orgName
      });
      newTrip.passengerNotification = passengerNotif;

      const isRealPassengerEmail = (em) =>
        Boolean(
          em &&
            String(em).includes('@') &&
            !String(em).toLowerCase().endsWith('@shuttletrack.com') &&
            !String(em).toLowerCase().endsWith('@shuttletracker.com')
        );

      let matchedPassengers = store.users.filter(
        (u) =>
          u.role === 'user' &&
          isRealPassengerEmail(u.email) &&
          String(u.bus_number || '').trim().toUpperCase() === String(busCode).trim().toUpperCase()
      );
      if (matchedPassengers.length === 0) {
        matchedPassengers = store.users.filter(
          (u) =>
            u.role === 'user' &&
            isRealPassengerEmail(u.email) &&
            matchesOrg(u.organization_name, orgName)
        );
      }
      if (matchedPassengers.length === 0) {
        matchedPassengers = store.users.filter((u) => u.role === 'user' && isRealPassengerEmail(u.email));
      }

      const passengerEmails = matchedPassengers.map((u) => u.email);
      if (passengerEmails.length > 0) {
        const { sendPassengerTripStartedEmail } = require('../services/otpService');
        const emailRes = await sendPassengerTripStartedEmail({
          passengerEmails,
          busCode,
          shuttleName: shuttle?.name || `Shuttle ${busCode}`,
          vehicleNumber: shuttle?.vehicle_number || '',
          driverName,
          startPoint: startPt,
          destination: destPt,
          routeName,
          organizationName: orgName
        });
        newTrip.emailDeliveredVia = emailRes?.deliveredVia || null;
        newTrip.emailRelayPayload = emailRes?.relayPayload || null;
      }
    } catch (passNotifyErr) {
      console.warn('Passenger trip start notification/email notice:', passNotifyErr.message);
    }

    return newTrip;
  },
  endTrip: async (tripId, explicitShuttleId = null) => {
    const idNum = Number(tripId);
    const explicitSId = explicitShuttleId ? Number(explicitShuttleId) : null;

    let trip =
      store.trips.find((t) => Number(t.id) === idNum) ||
      store.trips.find(
        (t) =>
          (t.status === 'in_progress' || t.status === 'ongoing') &&
          (Number(t.shuttle_id) === (explicitSId || idNum))
      ) ||
      store.trips.find((t) => Number(t.shuttle_id) === (explicitSId || idNum)) ||
      null;

    const shuttle =
      (explicitSId && store.shuttles.find((s) => Number(s.id) === explicitSId)) ||
      (trip && store.shuttles.find((s) => Number(s.id) === Number(trip.shuttle_id))) ||
      store.shuttles.find((s) => Number(s.id) === idNum || Number(s.trip_id) === idNum) ||
      store.shuttles.find((s) => s.status === 'on_trip' || s.status === 'delayed') ||
      store.shuttles[0] ||
      null;

    const resolvedShuttleId = shuttle ? Number(shuttle.id) : explicitSId || idNum || 1;

    // Mark all ongoing trips for this shuttle as completed
    store.trips.forEach((t) => {
      if (
        Number(t.id) === idNum ||
        Number(t.shuttle_id) === resolvedShuttleId
      ) {
        t.status = 'completed';
        t.end_time = new Date().toISOString();
      }
    });

    if (shuttle) {
      shuttle.status = 'idle';
      shuttle.trip_id = null;
      shuttle.speed = 0;
      shuttle.next_stop_name = 'Destination Reached';
      if (isPostgresConnected && pool) {
        try {
          await pool.query("UPDATE shuttles SET status = 'idle', speed = 0 WHERE id = $1", [shuttle.id]);
          await pool.query(
            "UPDATE trips SET status = 'completed', ended_at = CURRENT_TIMESTAMP WHERE shuttle_id = $1 OR id = $2",
            [shuttle.id, idNum || 0]
          );
        } catch (_) {}
      }
      // Mark schedule as arrived/completed in window so turning off End Trip button never triggers a false alert
      store.schedules.forEach((sc) => {
        if (Number(sc.shuttle_id) === Number(shuttle.id)) {
          sc.driver_arrived = true;
          sc.trip_completed_in_window = true;
          sc.driver_not_started_notified = true;
          sc.status = Number(sc.delay_minutes) > 0 ? 'delayed' : 'arrived_on_time';
        }
      });
    }

    return (
      trip || {
        id: idNum || resolvedShuttleId,
        shuttle_id: resolvedShuttleId,
        status: 'completed',
        delay_minutes: 0
      }
    );
  },

  // Notifications
  getNotifications: async (userId = null, orgName = null) => {
    let list = store.notifications;
    if (orgName) {
      list = list.filter((n) => !n.organization_name || matchesOrg(n.organization_name, orgName));
    }
    if (userId === null) {
      // Admin notifications exclude driver-only schedule notifications
      return list.filter((n) => n.type !== 'driver_schedule');
    }
    return list.filter((n) => n.user_id === null || n.user_id === Number(userId));
  },
  createNotification: async (notifData) => {
    const shuttleObj = notifData.shuttle_id
      ? store.shuttles.find((s) => Number(s.id) === Number(notifData.shuttle_id))
      : null;
    const orgName =
      notifData.organization_name ||
      shuttleObj?.organization_name ||
      store.settings?.organization_name ||
      'Sathyabama Institute of Science and Technology';

    let newNotif = {
      id: store.notifications.length ? Math.max(...store.notifications.map((n) => n.id)) + 1 : 1,
      title: notifData.title,
      message: notifData.message,
      type: notifData.type || 'info',
      shuttle_id: notifData.shuttle_id ? Number(notifData.shuttle_id) : null,
      user_id: notifData.user_id ? Number(notifData.user_id) : null,
      organization_name: orgName,
      is_read: false,
      created_at: new Date().toISOString()
    };

    if (isPostgresConnected && pool) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO notifications (user_id, shuttle_id, title, message, type, is_read, organization_name)
           VALUES ($1, $2, $3, $4, $5, false, $6)
           RETURNING *`,
          [
            newNotif.user_id,
            newNotif.shuttle_id,
            newNotif.title,
            newNotif.message,
            newNotif.type,
            orgName
          ]
        );
        if (rows.length > 0) newNotif = { ...newNotif, ...rows[0] };
      } catch (_) {}
    }

    store.notifications.unshift(newNotif);
    return newNotif;
  },
  markNotificationRead: async (id) => {
    const notif = store.notifications.find((n) => n.id === Number(id));
    if (notif) notif.is_read = true;
    return notif;
  },
  markAllNotificationsRead: async () => {
    store.notifications.forEach((n) => {
      n.is_read = true;
    });
    return true;
  },

  // Schedule Monitor:
  // 1) Earlier / Active Schedule Reminder to Driver (in Driver Login + Email)
  // 2) One-time Admin Notification when Driver has NOT pressed Start Trip at scheduled time
  // 3) One-time Admin Notification + Cumulative Driver Points calculation when Driver does NOT reach destination on scheduled time
  checkScheduledTripsNotStarted: async () => {
    const createdNotifications = [];
    const { sendDriverScheduleEmail } = require('../services/otpService');

    for (const sc of store.schedules) {
      const shuttle = store.shuttles.find((s) => Number(s.id) === Number(sc.shuttle_id));
      if (!shuttle) continue;

      const driver = resolveDriverForShuttle(shuttle);
      const driverUser = driver ? store.users.find((u) => u.id === driver.user_id) : null;
      const route = resolveRouteForShuttle(shuttle);
      const driverName = driver ? driverUser?.name || driver.name : 'Allocated Driver';
      const driverEmail = driver ? driverUser?.email || driver.email : '';
      const startPt = shuttle.start_point || route?.start_point || 'Starting Point';
      const destPt = shuttle.destination || route?.end_point || 'Destination';
      const isOnTrip = shuttle.status === 'on_trip';

      const inWindow = isTimeWithinScheduleWindow(sc.departure_time, sc.arrival_time);
      const minsUntilDep = getMinutesUntilDeparture(sc.departure_time);
      const isApproaching = minsUntilDep !== null && minsUntilDep >= 0 && minsUntilDep <= 30;
      const minsPastArrival = getMinutesPastScheduledArrival(sc.departure_time, sc.arrival_time);

      // A) Notify Driver earlier (up to 30 mins before) or when schedule time is ON
      if ((isApproaching || inWindow) && !sc.driver_schedule_reminder_sent && !isOnTrip && !sc.driver_arrived) {
        sc.driver_schedule_reminder_sent = true;
        await db.createNotification({
          title: `⏰ Your Schedule Time is On (${sc.departure_time} – ${sc.arrival_time}) — Ready to Ride Safely!`,
          message: `Hello ${driverName}, your scheduled trip on Bus ${shuttle.code} (${startPt} ➔ ${destPt}) is ${
            inWindow ? 'active now' : `starting soon at ${sc.departure_time}`
          } (${sc.departure_time} – ${sc.arrival_time}). Please be ready to ride safely and press START TRIP on time!`,
          type: 'driver_schedule',
          shuttle_id: shuttle.id,
          user_id: driver?.user_id || null,
          organization_name: shuttle.organization_name
        });

        if (driverEmail) {
          sendDriverScheduleEmail({
            email: driverEmail,
            name: driverName,
            shuttleCode: shuttle.code,
            shuttleName: shuttle.name,
            vehicleNumber: shuttle.vehicle_number,
            startPoint: startPt,
            destination: destPt,
            routeName: route?.name || `${startPt} ➔ ${destPt}`,
            departureTime: sc.departure_time,
            arrivalTime: sc.arrival_time,
            days: sc.days || 'Mon - Fri',
            isReminder: true
          }).catch(() => {});
        }
      }

      // B) Notify Admin ONLY if in scheduled time window AND driver has NOT started trip AND has NOT already completed the trip
      if (inWindow) {
        if (!isOnTrip && !sc.driver_arrived && !sc.trip_completed_in_window && !sc.driver_not_started_notified) {
          sc.driver_not_started_notified = true;
          const notif = await db.createNotification({
            title: `⚠️ Driver Not Started Trip: Bus ${shuttle.code}`,
            message: `Driver ${driverName} allocated to Bus ${shuttle.code} (${startPt} ➔ ${destPt}) has NOT pressed the Start Trip button at the scheduled time (${sc.departure_time} – ${sc.arrival_time}). Live tracking is disabled until the driver starts the trip.`,
            type: 'delay',
            shuttle_id: shuttle.id,
            organization_name: shuttle.organization_name
          });
          createdNotifications.push(notif);
        }
      } else if (!isApproaching && minsPastArrival === 0) {
        // Outside schedule window and not past arrival: reset flags for the next day's window
        sc.driver_not_started_notified = false;
        sc.driver_schedule_reminder_sent = false;
      }

      // C) If Driver did NOT reach destination on scheduled arrival time (past arrival_time while on_trip or not arrived),
      // notify Admin that driver is delayed and calculate cumulative driver points based on that delay!
      if (minsPastArrival > 0 && isOnTrip && !sc.driver_arrived && !sc.admin_delay_notified_for_trip) {
        const arrivalDelayedRes = await db.recordDriverDestinationArrival(
          shuttle.id,
          Math.max(1, minsPastArrival),
          { stillInTransitPastSchedule: true }
        );
        if (arrivalDelayedRes?.notification) {
          createdNotifications.push(arrivalDelayedRes.notification);
        }
      }
    }
    return createdNotifications;
  },

  // Schedules with exact route duration, driver destination arrival time & cumulative all-trips (monthly/yearly) points
  getAllSchedules: async (orgName = null) => {
    const addMinutesToTimeStr = (timeStr, minutesToAdd = 0) => {
      if (!timeStr) return '08:25 AM';
      try {
        const clean = String(timeStr).trim().toUpperCase();
        const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
        let hours = 8;
        let mins = 0;
        if (match12) {
          hours = parseInt(match12[1], 10);
          mins = parseInt(match12[2], 10);
          const period = match12[3];
          if (period === 'PM' && hours < 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
        } else {
          const match24 = clean.match(/^(\d{1,2}):(\d{2})/);
          if (match24) {
            hours = parseInt(match24[1], 10);
            mins = parseInt(match24[2], 10);
          }
        }
        const total = hours * 60 + mins + Number(minutesToAdd || 0);
        const h24 = ((Math.floor(total / 60) % 24) + 24) % 24;
        const m = ((total % 60) + 60) % 60;
        const p = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
      } catch (_) {
        return timeStr;
      }
    };

    const schedulesList = orgName
      ? store.schedules.filter((sc) => {
          if (matchesOrg(sc.organization_name, orgName)) return true;
          const sht = store.shuttles.find((s) => s.id === Number(sc.shuttle_id));
          return sht ? matchesOrg(sht.organization_name, orgName) : false;
        })
      : store.schedules;

    return schedulesList.map((sched) => {
      const shuttle = store.shuttles.find((s) => s.id === Number(sched.shuttle_id));
      const driver = shuttle ? resolveDriverForShuttle(shuttle) : null;
      const driverUser = driver ? store.users.find((u) => u.id === driver.user_id) : null;
      const route =
        store.routes.find((r) => r.id === Number(sched.route_id)) ||
        (shuttle ? resolveRouteForShuttle(shuttle) : null);

      const durationMins = route?.estimated_time_minutes || shuttle?.eta_minutes || 18;
      const scheduledArrival =
        sched.arrival_time || addMinutesToTimeStr(sched.departure_time, durationMins);

      const resolvedStart = shuttle?.start_point || route?.start_point || sched.start_point || '';
      const resolvedDest = shuttle?.destination || route?.end_point || sched.destination || '';
      const resolvedRouteName =
        route?.name ||
        (sched.route_name && sched.route_name !== 'Main Campus Loop' ? sched.route_name : '') ||
        (resolvedStart && resolvedDest ? `${resolvedStart} ➔ ${resolvedDest}` : 'Assigned Route');

      const isOnTrip = Boolean(shuttle && shuttle.status === 'on_trip');
      const isScheduledTimeNow = isTimeWithinScheduleWindow(sched.departure_time, scheduledArrival);

      // Cumulative all-trips points (Monthly & Yearly — persisted across all trips)
      const cumulativePoints =
        Number(driver?.driver_points) ||
        Number(driver?.monthly_points) ||
        Number(sched.driver_points) ||
        Number(sched.monthly_points) ||
        0;
      const monthlyPoints =
        Number(driver?.monthly_points) || Number(sched.monthly_points) || cumulativePoints;
      const yearlyPoints =
        Number(driver?.yearly_points) || Number(sched.yearly_points) || cumulativePoints;
      const totalTrips =
        Number(driver?.total_trips) ||
        Number(sched.total_trips) ||
        Number(sched.daily_trips) ||
        0;

      return {
        ...sched,
        organization_name:
          sched.organization_name ||
          shuttle?.organization_name ||
          store.settings?.organization_name ||
          'Sathyabama Institute of Science and Technology',
        shuttle_code: shuttle ? shuttle.code : sched.shuttle_code || '',
        shuttle_name: shuttle ? shuttle.name : sched.shuttle_name || '',
        driver_name: driver ? driverUser?.name || driver.name : 'No Driver Allocated',
        route_name: resolvedRouteName,
        start_point: resolvedStart,
        destination: resolvedDest,
        distance_km: route?.distance_km || shuttle?.distance_km || 0,
        estimated_time_minutes: durationMins,
        arrival_time: scheduledArrival,
        is_on_trip: isOnTrip,
        is_scheduled_time_now: isScheduledTimeNow,
        driver_not_started_notified: Boolean(sched.driver_not_started_notified),
        driver_arrived: Boolean(sched.driver_arrived),
        actual_arrival_time: sched.actual_arrival_time || null,
        arrived_at_live: sched.arrived_at_live || null,
        delay_minutes: Number(sched.delay_minutes) || 0,
        total_trips: totalTrips,
        daily_trips: totalTrips,
        driver_points: cumulativePoints,
        monthly_points: monthlyPoints,
        yearly_points: yearlyPoints,
        last_points_earned: Number(sched.last_points_earned) || Number(driver?.last_points_earned) || 0,
        admin_delay_notified_for_trip: Boolean(sched.admin_delay_notified_for_trip),
        admin_offroute_notified_for_trip: Boolean(sched.admin_offroute_notified_for_trip),
        next_stop_name: isOnTrip ? shuttle?.next_stop_name || resolvedDest : 'Trip Not Started',
        eta_minutes: shuttle?.eta_minutes || durationMins,
        status: sched.driver_arrived
          ? Number(sched.delay_minutes) > 0
            ? 'delayed'
            : 'arrived_on_time'
          : isOnTrip
          ? 'on_trip'
          : shuttle?.status === 'delayed'
          ? 'delayed_in_transit'
          : 'not_started'
      };
    });
  },

  createSchedule: async (schedData) => {
    const sId = Number(schedData.shuttle_id) || 1;
    const shuttle = store.shuttles.find((s) => Number(s.id) === sId);
    const driver = shuttle ? resolveDriverForShuttle(shuttle) : null;
    const driverUser = driver ? store.users.find((u) => u.id === driver.user_id) : null;
    const route =
      (schedData.route_id ? store.routes.find((r) => Number(r.id) === Number(schedData.route_id)) : null) ||
      (shuttle ? resolveRouteForShuttle(shuttle) : null);

    const resolvedStart = shuttle?.start_point || route?.start_point || '';
    const resolvedDest = shuttle?.destination || route?.end_point || '';
    const resolvedRouteName =
      route?.name ||
      schedData.route_name ||
      (resolvedStart && resolvedDest ? `${resolvedStart} ➔ ${resolvedDest}` : 'Assigned Route');

    const orgName =
      String(
        schedData.organization_name ||
          shuttle?.organization_name ||
          route?.organization_name ||
          store.settings?.organization_name ||
          'Sathyabama Institute of Science and Technology'
      ).trim();

    const initialPoints = Number(driver?.driver_points) || Number(driver?.monthly_points) || 0;
    const initialYearly = Number(driver?.yearly_points) || initialPoints;
    const initialTrips = Number(driver?.total_trips) || 0;

    let newSched = {
      id: store.schedules.length ? Math.max(...store.schedules.map((s) => s.id)) + 1 : 1,
      route_id: route ? route.id : Number(schedData.route_id) || 1,
      route_name: resolvedRouteName,
      shuttle_id: sId,
      departure_time: schedData.departure_time,
      arrival_time: schedData.arrival_time,
      days: schedData.days || 'Mon - Fri',
      organization_name: orgName,
      driver_arrived: false,
      trip_completed_in_window: false,
      driver_not_started_notified: false,
      driver_schedule_reminder_sent: true,
      actual_arrival_time: null,
      delay_minutes: 0,
      total_trips: initialTrips,
      daily_trips: initialTrips,
      driver_points: initialPoints,
      monthly_points: initialPoints,
      yearly_points: initialYearly,
      last_points_earned: 0,
      status: shuttle?.status === 'on_trip' ? 'on_trip' : 'not_started'
    };

    if (isPostgresConnected && pool) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO schedules (route_id, route_name, shuttle_id, departure_time, arrival_time, days, status, organization_name, driver_points, monthly_points, yearly_points, total_trips)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            newSched.route_id,
            newSched.route_name,
            newSched.shuttle_id,
            newSched.departure_time,
            newSched.arrival_time,
            newSched.days,
            orgName,
            initialPoints,
            initialPoints,
            initialYearly,
            initialTrips
          ]
        );
        if (rows.length > 0) {
          newSched = {
            ...newSched,
            ...rows[0],
            organization_name: orgName,
            status: shuttle?.status === 'on_trip' ? 'on_trip' : 'not_started'
          };
        }
      } catch (_) {}
    }

    store.schedules.push(newSched);

    // Notify the assigned Driver in Driver Login and send an Email from Admin to the Driver:
    // "Your schedule time is on — please be ready to ride safely!"
    const fallbackDriverUser =
      !driverUser &&
      store.users.find(
        (u) =>
          u.role === 'driver' &&
          matchesOrg(u.organization_name, orgName) &&
          u.email &&
          !u.email.toLowerCase().endsWith('@shuttletrack.com')
      );
    const driverName = driver ? driverUser?.name || driver.name : fallbackDriverUser?.name || 'Driver';
    const driverEmail =
      (driver && (driverUser?.email || driver.email)) || fallbackDriverUser?.email || '';
    const busCode = shuttle?.code || `S0${sId}`;

    const driverNotification = await db.createNotification({
      title: `📅 Schedule Set (${newSched.departure_time} – ${newSched.arrival_time}) — Ready to Ride Safely!`,
      message: `Admin has set your schedule for Bus ${busCode} (${resolvedStart || 'Start'} ➔ ${resolvedDest || 'Destination'}) from ${newSched.departure_time} to ${newSched.arrival_time} (${newSched.days}). Your schedule time is on — please be ready to ride safely!`,
      type: 'driver_schedule',
      shuttle_id: sId,
      user_id: driver?.user_id || fallbackDriverUser?.id || null,
      organization_name: orgName
    });

    let emailDelivery = null;
    if (driverEmail) {
      try {
        const { sendDriverScheduleEmail } = require('../services/otpService');
        emailDelivery = await sendDriverScheduleEmail({
          email: driverEmail,
          name: driverName,
          shuttleCode: busCode,
          shuttleName: shuttle?.name || 'Campus Shuttle',
          vehicleNumber: shuttle?.vehicle_number || '',
          startPoint: resolvedStart || 'Start Terminal',
          destination: resolvedDest || 'Destination Terminal',
          routeName: resolvedRouteName,
          departureTime: newSched.departure_time,
          arrivalTime: newSched.arrival_time,
          days: newSched.days,
          isReminder: false
        });
      } catch (_) {}
    }

    // Immediately check if this new schedule is currently in its scheduled time window without driver having pressed Start Trip
    await db.checkScheduledTripsNotStarted();

    return {
      ...newSched,
      driverName,
      driverEmail,
      driverUserId: driver?.user_id || fallbackDriverUser?.id || null,
      shuttleCode: busCode,
      startPoint: resolvedStart,
      destination: resolvedDest,
      driverNotification,
      emailDeliveredVia: emailDelivery?.deliveredVia || null,
      emailRelayPayload: emailDelivery?.relayPayload || null
    };
  },

  deleteSchedule: async (scheduleId) => {
    const idNum = Number(scheduleId);
    const idx = store.schedules.findIndex((s) => Number(s.id) === idNum);
    if (idx === -1) return false;
    store.schedules.splice(idx, 1);
    if (isPostgresConnected && pool) {
      try {
        await pool.query('DELETE FROM schedules WHERE id = $1', [idNum]);
      } catch (err) {
        console.warn('Postgres deleteSchedule warning:', err.message);
      }
    }
    return true;
  },

  // Automatic & Manual Destination Arrival / Delay Handler:
  // - Points are cumulative across ALL TRIPS (Monthly & Yearly — NOT daily or single-trip!).
  // - If driver reaches destination within scheduled time (delayMins === 0) and turns off End Trip button:
  //   Do NOT notify Admin that driver turned off the button! Award +10 points to cumulative Monthly & Yearly points.
  // - If driver does NOT reach destination on scheduled time (delayMins > 0):
  //   Notify Admin that driver is delayed and calculate cumulative driver points based on the delay!
  recordDriverDestinationArrival: async (shuttleId, customDelayMinutes = null, options = {}) => {
    const addMinutesToTimeStr = (timeStr, minutesToAdd = 0) => {
      if (!timeStr) return '08:25 AM';
      try {
        const clean = String(timeStr).trim().toUpperCase();
        const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
        let hours = 8;
        let mins = 0;
        if (match12) {
          hours = parseInt(match12[1], 10);
          mins = parseInt(match12[2], 10);
          const period = match12[3];
          if (period === 'PM' && hours < 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
        } else {
          const match24 = clean.match(/^(\d{1,2}):(\d{2})/);
          if (match24) {
            hours = parseInt(match24[1], 10);
            mins = parseInt(match24[2], 10);
          }
        }
        const total = hours * 60 + mins + Number(minutesToAdd || 0);
        const h24 = ((Math.floor(total / 60) % 24) + 24) % 24;
        const m = ((total % 60) + 60) % 60;
        const p = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
      } catch (_) {
        return timeStr;
      }
    };

    const shuttle =
      store.shuttles.find((s) => Number(s.id) === Number(shuttleId)) ||
      store.shuttles[0] || {
        id: Number(shuttleId) || 1,
        code: `S0${Number(shuttleId) || 1}`,
        name: `Shuttle S0${Number(shuttleId) || 1}`,
        start_point: 'Start',
        destination: 'Destination',
        organization_name: store.settings?.organization_name || 'Sairam Engineering College'
      };

    const driver = resolveDriverForShuttle(shuttle) || store.drivers[0] || null;
    const route = resolveRouteForShuttle(shuttle);

    const activeTrip = store.trips.find(
      (t) => Number(t.shuttle_id) === Number(shuttle.id) && t.status === 'in_progress'
    );

    const matchingSchedules = store.schedules.filter(
      (item) => Number(item.shuttle_id) === Number(shuttle.id)
    );
    const sc =
      matchingSchedules.find((item) =>
        isTimeWithinScheduleWindow(item.departure_time, item.arrival_time)
      ) || matchingSchedules[0];

    const duration = route?.estimated_time_minutes || 18;
    const schedArr = sc
      ? sc.arrival_time || addMinutesToTimeStr(sc.departure_time, duration)
      : '08:30 AM';

    const minsPastSchedArr = sc ? getMinutesPastScheduledArrival(sc.departure_time, schedArr) : 0;

    let delayMins = 0;
    if (customDelayMinutes !== null && customDelayMinutes !== undefined && Number(customDelayMinutes) > 0) {
      delayMins = Math.max(0, Number(customDelayMinutes));
    } else if (sc && Number(sc.delay_minutes) > 0) {
      delayMins = Number(sc.delay_minutes);
    } else if (activeTrip && Number(activeTrip.delay_minutes) > 0) {
      delayMins = Number(activeTrip.delay_minutes);
    } else if (shuttle.status === 'delayed') {
      delayMins = Math.max(5, minsPastSchedArr);
    } else if (minsPastSchedArr > 0) {
      delayMins = minsPastSchedArr;
    }

    // Calculate driver points for this trip and accumulate across ALL TRIPS (Monthly & Yearly):
    // - On-Time (delayMins === 0): +10 points
    // - Delayed (delayMins > 0): reduced points based on delay (10 - delayMins, min +2 pts)
    const basePoints = delayMins === 0 ? 10 : Math.max(2, 10 - delayMins);
    const liveClockStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    let sampleScheduledArrival = schedArr;
    let sampleActualArrival = liveClockStr;
    let pointsEarned = basePoints;
    let notification = null;
    let alreadyDelayNotified = false;

    if (sc) {
      alreadyDelayNotified = Boolean(sc.admin_delay_notified_for_trip);
      const actualArr = delayMins > 0 ? addMinutesToTimeStr(schedArr, delayMins) : liveClockStr;

      sampleScheduledArrival = schedArr;
      sampleActualArrival = actualArr;

      if (!options.stillInTransitPastSchedule) {
        sc.driver_arrived = true;
        sc.trip_completed_in_window = true;
        sc.driver_not_started_notified = true;
      }
      sc.delay_minutes = delayMins;
      sc.actual_arrival_time = actualArr;
      sc.arrived_at_live = liveClockStr;
      sc.status = delayMins > 0 ? 'delayed' : 'arrived_on_time';

      if (!sc.point_awarded_for_trip) {
        pointsEarned = basePoints;
        const prevCumulative =
          Number(driver?.driver_points) ||
          Number(driver?.monthly_points) ||
          Number(sc.driver_points) ||
          Number(sc.monthly_points) ||
          0;
        const prevYearly = Number(driver?.yearly_points) || Number(sc.yearly_points) || prevCumulative;
        const prevTrips =
          Number(driver?.total_trips) || Number(sc.total_trips) || Number(sc.daily_trips) || 0;

        const nextMonthly = prevCumulative + pointsEarned;
        const nextYearly = prevYearly + pointsEarned;
        const nextTrips = prevTrips + 1;

        sc.driver_points = nextMonthly;
        sc.monthly_points = nextMonthly;
        sc.yearly_points = nextYearly;
        sc.last_points_earned = pointsEarned;
        sc.total_trips = nextTrips;
        sc.daily_trips = nextTrips;
        sc.point_awarded_for_trip = true;

        if (driver) {
          driver.total_trips = nextTrips;
          driver.driver_points = nextMonthly;
          driver.monthly_points = nextMonthly;
          driver.yearly_points = nextYearly;
          driver.daily_points = nextMonthly;
          driver.last_points_earned = pointsEarned;
        }
      } else if (delayMins > 0 && Number(sc.last_points_earned) !== basePoints) {
        // Adjust cumulative points if delay occurred after initial point calculation
        const diff = basePoints - (Number(sc.last_points_earned) || 0);
        sc.driver_points = Math.max(0, (Number(sc.driver_points) || 0) + diff);
        sc.monthly_points = Math.max(0, (Number(sc.monthly_points) || sc.driver_points) + diff);
        sc.yearly_points = Math.max(0, (Number(sc.yearly_points) || sc.driver_points) + diff);
        sc.last_points_earned = basePoints;
        pointsEarned = basePoints;
        if (driver) {
          driver.driver_points = sc.driver_points;
          driver.monthly_points = sc.monthly_points;
          driver.yearly_points = sc.yearly_points;
          driver.daily_points = sc.driver_points;
          driver.last_points_earned = basePoints;
        }
      }

      // Sync cumulative points across all schedules for the same shuttle and persist to PostgreSQL
      matchingSchedules.forEach((otherSc) => {
        otherSc.driver_points = sc.driver_points;
        otherSc.monthly_points = sc.monthly_points;
        otherSc.yearly_points = sc.yearly_points;
        otherSc.total_trips = sc.total_trips;
        otherSc.daily_trips = sc.total_trips;
        otherSc.last_points_earned = sc.last_points_earned;
        if (otherSc.id !== sc.id && !options.stillInTransitPastSchedule) {
          otherSc.driver_arrived = true;
          otherSc.trip_completed_in_window = true;
          otherSc.driver_not_started_notified = true;
        }
      });

      if (isPostgresConnected && pool) {
        try {
          await pool.query(
            `UPDATE schedules
             SET driver_points = $1, monthly_points = $2, yearly_points = $3,
                 total_trips = $4, last_points_earned = $5, delay_minutes = $6, actual_arrival_time = $7
             WHERE shuttle_id = $8`,
            [
              sc.driver_points,
              sc.monthly_points,
              sc.yearly_points,
              sc.total_trips,
              sc.last_points_earned,
              sc.delay_minutes,
              sc.actual_arrival_time,
              shuttle.id
            ]
          );
          if (driver) {
            await pool.query(
              `UPDATE drivers
               SET driver_points = $1, monthly_points = $2, yearly_points = $3,
                   total_trips = $4, last_points_earned = $5
               WHERE id = $6`,
              [
                driver.driver_points,
                driver.monthly_points,
                driver.yearly_points,
                driver.total_trips,
                driver.last_points_earned,
                driver.id
              ]
            );
          }
        } catch (_) {}
      }

      // IMPORTANT: Only notify Admin when driver is delayed (delayMins > 0).
      // When driver reaches destination within scheduled time (delayMins === 0) and turns off End Trip button, DO NOT notify!
      if (delayMins > 0 && (!sc.admin_delay_notified_for_trip || options.forceNotify)) {
        sc.admin_delay_notified_for_trip = true;
        const busCode = shuttle.code || `S0${shuttle.id}`;
        const driverName = driver?.name || 'Assigned Driver';
        const destName = shuttle.destination || route?.end_point || 'Destination';
        notification = await db.createNotification({
          title: `⏰ Driver Delayed: Bus ${busCode} (${driverName})`,
          message: options.customReason
            ? `${options.customReason} — Bus ${busCode} (Driver: ${driverName}) is delayed by +${delayMins} min(s). Driver points calculated for this trip: +${basePoints} pts (Monthly/All-Trips Total: ${sc.driver_points} pts).`
            : options.stillInTransitPastSchedule
            ? `Driver ${driverName} on Bus ${busCode} did not reach destination "${destName}" on scheduled time (${sampleScheduledArrival}) — delayed by ${delayMins} min(s). Driver points calculated for this trip: +${basePoints} pts (Monthly/All-Trips Total: ${sc.driver_points} pts).`
            : `Driver ${driverName} on Bus ${busCode} reached destination "${destName}" at ${sampleActualArrival} (${delayMins} min delay past scheduled ${sampleScheduledArrival}). Driver points calculated for this trip: +${basePoints} pts (Monthly/All-Trips Total: ${sc.driver_points} pts).`,
          type: 'delay',
          shuttle_id: shuttle.id,
          organization_name: shuttle.organization_name
        });
      }
    } else if (driver) {
      driver.total_trips = (Number(driver.total_trips) || 0) + 1;
      driver.driver_points = (Number(driver.driver_points) || 0) + basePoints;
      driver.monthly_points = (Number(driver.monthly_points) || 0) + basePoints;
      driver.yearly_points = (Number(driver.yearly_points) || 0) + basePoints;
      driver.daily_points = driver.driver_points;
      driver.last_points_earned = basePoints;
      if (isPostgresConnected && pool) {
        try {
          await pool.query(
            `UPDATE drivers
             SET driver_points = $1, monthly_points = $2, yearly_points = $3,
                 total_trips = $4, last_points_earned = $5
             WHERE id = $6`,
            [
              driver.driver_points,
              driver.monthly_points,
              driver.yearly_points,
              driver.total_trips,
              basePoints,
              driver.id
            ]
          );
        } catch (_) {}
      }

      if (delayMins > 0 && (!shuttle.admin_delay_notified_for_trip || options.forceNotify)) {
        shuttle.admin_delay_notified_for_trip = true;
        const busCode = shuttle.code || `S0${shuttle.id}`;
        const driverName = driver?.name || 'Assigned Driver';
        const destName = shuttle.destination || route?.end_point || 'Destination';
        notification = await db.createNotification({
          title: `⏰ Driver Delayed: Bus ${busCode} (${driverName})`,
          message: options.customReason
            ? `${options.customReason} — Bus ${busCode} (Driver: ${driverName}) is delayed by +${delayMins} min(s) heading to "${destName}".`
            : `Driver ${driverName} on Bus ${busCode} is delayed by +${delayMins} min(s) heading to "${destName}". Driver points calculated: +${basePoints} pts (Cumulative: ${driver.driver_points} pts).`,
          type: 'delay',
          shuttle_id: shuttle.id,
          organization_name: shuttle.organization_name
        });
      }
    }

    // Fallback: if delayMins > 0 and no schedule/driver object matched above, still create the Admin Delay Notification
    if (delayMins > 0 && !notification && (!shuttle.admin_delay_notified_for_trip || options.forceNotify)) {
      shuttle.admin_delay_notified_for_trip = true;
      const busCode = shuttle.code || `S0${shuttle.id}`;
      const driverName = driver?.name || shuttle.driver_name || 'Assigned Driver';
      const destName = shuttle.destination || route?.end_point || 'Destination';
      notification = await db.createNotification({
        title: `⏰ Driver Delayed: Bus ${busCode} (${driverName})`,
        message: options.customReason
          ? `${options.customReason} — Bus ${busCode} (Driver: ${driverName}) is delayed by +${delayMins} min(s) heading to "${destName}".`
          : `Driver ${driverName} on Bus ${busCode} is delayed by +${delayMins} min(s) heading to "${destName}". Driver points calculated: +${basePoints} pts.`,
        type: 'delay',
        shuttle_id: shuttle.id,
        organization_name: shuttle.organization_name
      });
    }

    let emailDelivery = null;
    if (delayMins > 0 && notification) {
      try {
        const orgName =
          shuttle?.organization_name ||
          store.settings?.organization_name ||
          'Sairam Engineering College';
        const orgSettings = await db.getSettings(orgName);
        const candidateAdminEmails = ['cleancodeuniverse@gmail.com'];
        if (orgSettings?.admin_profile_email) {
          candidateAdminEmails.push(orgSettings.admin_profile_email);
        }
        store.users
          .filter((u) => u.role === 'admin' && u.email)
          .forEach((u) => candidateAdminEmails.push(u.email));

        const { sendAdminDelayEmail } = require('../services/otpService');
        emailDelivery = await sendAdminDelayEmail({
          adminEmails: candidateAdminEmails,
          adminName: orgSettings?.admin_profile_name || 'Administrator',
          busCode: shuttle.code || `S0${shuttle.id}`,
          shuttleName: shuttle.name || `Shuttle ${shuttle.code}`,
          vehicleNumber: shuttle.vehicle_number || '',
          driverName: driver?.name || 'Assigned Driver',
          routeName:
            route?.name ||
            `${shuttle.start_point || 'Start'} ➔ ${shuttle.destination || 'Destination'}`,
          destination: shuttle.destination || route?.end_point || 'Destination',
          scheduledArrival: sampleScheduledArrival,
          actualArrival: sampleActualArrival,
          delayMinutes: delayMins,
          pointsEarned,
          totalDriverPoints: sc ? sc.driver_points : driver?.driver_points || basePoints,
          reason: notification.message,
          organizationName: orgName
        });
        if (emailDelivery?.relayPayload) {
          notification.emailRelayPayload = emailDelivery.relayPayload;
        }
      } catch (delayEmailErr) {
        console.warn('Delay email dispatch notice:', delayEmailErr.message);
      }
    }

    return {
      shuttleId: shuttle.id,
      shuttleCode: shuttle.code,
      driverName: driver?.name || 'Assigned Driver',
      destination: shuttle.destination || route?.end_point || 'Destination',
      driverArrived: !options.stillInTransitPastSchedule,
      reachedOnTime: delayMins === 0,
      delayMinutes: delayMins,
      pointsEarned,
      totalDriverPoints: sc ? sc.driver_points : driver?.driver_points || basePoints,
      monthlyDriverPoints: sc ? sc.monthly_points : driver?.monthly_points || basePoints,
      yearlyDriverPoints: sc ? sc.yearly_points : driver?.yearly_points || basePoints,
      totalTripsCompleted: sc ? sc.total_trips : driver?.total_trips || 1,
      alreadyDelayNotified,
      notification,
      emailDeliveredVia: emailDelivery?.deliveredVia || null,
      emailRelayPayload: emailDelivery?.relayPayload || null,
      schedules: await db.getAllSchedules(shuttle.organization_name)
    };
  },

  recordDriverOffRouteDeviation: async (shuttleId, { latitude, longitude, reason, forceNotify = false } = {}) => {
    const shuttle = await db.getShuttleById(shuttleId || 1);
    const sId = shuttle ? shuttle.id : Number(shuttleId) || 1;
    const busCode = shuttle?.code || `S0${sId}`;
    const driverName = shuttle?.driver_name || 'Assigned Driver';
    const routeName =
      shuttle?.route?.name || `${shuttle?.start_point || 'Start'} ➔ ${shuttle?.destination || 'Destination'}`;

    const deviatedLat = Number(latitude) || (Number(shuttle?.current_lat) || 12.9602) + 0.0125;
    const deviatedLng = Number(longitude) || (Number(shuttle?.current_lng) || 80.0569) - 0.0118;

    if (shuttle) {
      await db.updateShuttle(shuttle.id, {
        current_lat: deviatedLat,
        current_lng: deviatedLng,
        status: 'on_trip'
      });
    }

    const sc = store.schedules.find((item) => Number(item.shuttle_id) === sId);
    if (!forceNotify && sc && sc.admin_offroute_notified_for_trip) {
      return {
        alreadyNotified: true,
        notification: null,
        shuttleId: sId,
        busCode,
        driverName,
        routeName,
        deviatedLat,
        deviatedLng
      };
    }

    if (sc) {
      sc.admin_offroute_notified_for_trip = true;
    }

    const alertMessage =
      reason ||
      `Driver ${driverName} (Bus ${busCode}) deviated from allocated route "${routeName}" at GPS (${deviatedLat.toFixed(4)}, ${deviatedLng.toFixed(4)}).`;

    const notif = await db.createNotification({
      title: `⚠️ Off-Route Alert: Bus ${busCode} (${driverName})`,
      message: alertMessage,
      type: 'off_route',
      shuttle_id: sId,
      organization_name: shuttle?.organization_name
    });

    let emailDelivery = null;
    try {
      const orgName =
        shuttle?.organization_name ||
        store.settings?.organization_name ||
        'Sairam Engineering College';
      const orgSettings = await db.getSettings(orgName);
      const candidateAdminEmails = ['cleancodeuniverse@gmail.com'];
      if (orgSettings?.admin_profile_email) {
        candidateAdminEmails.push(orgSettings.admin_profile_email);
      }
      store.users
        .filter((u) => u.role === 'admin' && u.email)
        .forEach((u) => candidateAdminEmails.push(u.email));

      const { sendAdminOffRouteEmail } = require('../services/otpService');
      emailDelivery = await sendAdminOffRouteEmail({
        adminEmails: candidateAdminEmails,
        adminName: orgSettings?.admin_profile_name || 'Administrator',
        busCode,
        shuttleName: shuttle?.name || `Shuttle ${busCode}`,
        vehicleNumber: shuttle?.vehicle_number || '',
        driverName,
        routeName,
        latitude: deviatedLat,
        longitude: deviatedLng,
        reason: alertMessage,
        organizationName: orgName
      });
      if (emailDelivery?.relayPayload) {
        notif.emailRelayPayload = emailDelivery.relayPayload;
      }
    } catch (offEmailErr) {
      console.warn('Off-route email dispatch notice:', offEmailErr.message);
    }

    return {
      alreadyNotified: false,
      notification: notif,
      shuttleId: sId,
      busCode,
      driverName,
      routeName,
      deviatedLat,
      deviatedLng,
      emailDeliveredVia: emailDelivery?.deliveredVia || null,
      emailRelayPayload: emailDelivery?.relayPayload || null
    };
  },

  recordBusStoppedEmergency: async (
    shuttleId,
    { reportedByRole = 'driver', reportedById = null, reportedByName = '', stoppedMinutes = 20, reason = '' } = {}
  ) => {
    const shuttle = await db.getShuttleById(shuttleId || 1);
    const sId = shuttle ? shuttle.id : Number(shuttleId) || 1;
    const shuttleObj = store.shuttles.find((s) => Number(s.id) === sId);
    const busCode = shuttle?.code || `S0${sId}`;
    const driverName = shuttle?.driver_name || 'Assigned Driver';
    const routeName =
      shuttle?.route?.name ||
      `${shuttle?.start_point || 'Start'} ➔ ${shuttle?.destination || 'Destination'}`;
    const stopName = shuttle?.next_stop_name || shuttle?.start_point || 'Route Corridor';
    const mins = Math.max(20, Number(stoppedMinutes) || 20);
    const requiredPassengerReports = 5;
    const maxPassengerReports = 10;
    const windowMs = 15 * 60 * 1000;
    const now = Date.now();

    let sc = store.schedules.find((item) => Number(item.shuttle_id) === sId);

    const rawReports = Array.isArray(shuttleObj?.passenger_emergency_reports)
      ? shuttleObj.passenger_emergency_reports
      : Array.isArray(sc?.passenger_emergency_reports)
      ? sc.passenger_emergency_reports
      : [];
    const existingReports = rawReports.filter((r) => now - Number(r.timestamp || 0) <= windowMs);

    if (rawReports.length > 0 && existingReports.length === 0) {
      if (shuttleObj) {
        shuttleObj.passenger_emergency_reports = [];
        shuttleObj.admin_emergency_stopped_notified_for_trip = false;
      }
      if (sc) {
        sc.passenger_emergency_reports = [];
        sc.admin_emergency_stopped_notified_for_trip = false;
      }
    }

    if (isPostgresConnected && pool) {
      try {
        await pool.query('DELETE FROM shuttle_emergency_reports WHERE reported_at < $1', [now - windowMs]);
      } catch (_) {}
    }

    const alreadyAdminNotified = Boolean(
      shuttleObj?.admin_emergency_stopped_notified_for_trip || sc?.admin_emergency_stopped_notified_for_trip
    );

    if (reportedByRole === 'user') {
      const passengerUser = store.users.find((u) => Number(u.id) === Number(reportedById));
      if (
        passengerUser &&
        passengerUser.bus_number &&
        String(passengerUser.bus_number).trim().toUpperCase() !== String(busCode).trim().toUpperCase()
      ) {
        return {
          notSameBus: true,
          alreadyNotified: alreadyAdminNotified,
          thresholdReached: alreadyAdminNotified,
          currentCount: Math.min(maxPassengerReports, existingReports.length),
          maxCount: maxPassengerReports,
          requiredCount: requiredPassengerReports,
          passengerEmergencyReports: existingReports,
          notification: null,
          shuttleId: sId,
          busCode,
          driverName,
          routeName,
          stopName
        };
      }

      const myExistingReport = existingReports.find(
        (r) =>
          (reportedById && Number(r.passengerId) === Number(reportedById)) ||
          (reportedByName &&
            r.passengerName &&
            String(r.passengerName).trim().toLowerCase() === String(reportedByName).trim().toLowerCase())
      );
      if (myExistingReport) {
        const remainingMinutes = Math.max(
          1,
          Math.ceil((windowMs - (now - Number(myExistingReport.timestamp || now))) / 60000)
        );
        return {
          alreadyReportedByPassenger: true,
          remainingMinutes,
          alreadyNotified: alreadyAdminNotified,
          thresholdReached: alreadyAdminNotified || existingReports.length >= requiredPassengerReports,
          currentCount: Math.min(maxPassengerReports, existingReports.length),
          maxCount: maxPassengerReports,
          requiredCount: requiredPassengerReports,
          passengerEmergencyReports: existingReports,
          notification: null,
          shuttleId: sId,
          busCode,
          driverName,
          routeName,
          stopName,
          stoppedMinutes: mins
        };
      }

      const newReport = {
        passengerId: Number(reportedById) || 0,
        passengerName: reportedByName || passengerUser?.name || 'Passenger',
        busCode,
        timestamp: now,
        expiresAt: now + windowMs
      };
      existingReports.push(newReport);

      if (shuttleObj) {
        shuttleObj.passenger_emergency_reports = existingReports;
      }
      if (sc) {
        sc.passenger_emergency_reports = existingReports;
      }

      const currentCount = Math.min(maxPassengerReports, existingReports.length);
      const willNotifyAdmin = currentCount >= requiredPassengerReports;

      if (isPostgresConnected && pool) {
        try {
          await pool.query(
            `INSERT INTO shuttle_emergency_reports (shuttle_id, bus_code, passenger_id, passenger_name, reported_at, notified_admin)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [sId, busCode, newReport.passengerId, newReport.passengerName, now, willNotifyAdmin]
          );
        } catch (_) {}
      }

      if (currentCount < requiredPassengerReports) {
        return {
          alreadyReportedByPassenger: false,
          alreadyNotified: false,
          thresholdReached: false,
          currentCount,
          maxCount: maxPassengerReports,
          requiredCount: requiredPassengerReports,
          passengerEmergencyReports: existingReports,
          notification: null,
          shuttleId: sId,
          busCode,
          driverName,
          routeName,
          stopName,
          stoppedMinutes: mins
        };
      }

      if (alreadyAdminNotified) {
        return {
          alreadyReportedByPassenger: false,
          alreadyNotified: true,
          thresholdReached: true,
          currentCount,
          maxCount: maxPassengerReports,
          requiredCount: requiredPassengerReports,
          passengerEmergencyReports: existingReports,
          notification: null,
          shuttleId: sId,
          busCode,
          driverName,
          routeName,
          stopName,
          stoppedMinutes: mins
        };
      }
    } else if (reportedByRole !== 'driver' && alreadyAdminNotified) {
      return {
        alreadyNotified: true,
        thresholdReached: true,
        currentCount: Math.max(requiredPassengerReports, existingReports.length),
        maxCount: maxPassengerReports,
        requiredCount: requiredPassengerReports,
        passengerEmergencyReports: existingReports,
        notification: null,
        shuttleId: sId,
        busCode,
        driverName,
        routeName,
        stopName,
        stoppedMinutes: mins
      };
    }

    if (shuttleObj) {
      shuttleObj.admin_emergency_stopped_notified_for_trip = true;
    }
    if (sc) {
      sc.admin_emergency_stopped_notified_for_trip = true;
    }

    if (shuttle) {
      await db.updateShuttle(sId, {
        speed: 0,
        status: 'delayed',
        next_stop_name: stopName.includes('Stopped') ? stopName : `${stopName} (Stopped ${mins}+ Min)`
      });
    }

    const currentCount = Math.min(maxPassengerReports, Math.max(requiredPassengerReports, existingReports.length));
    const passengerNamesList = existingReports.map((r) => r.passengerName).join(', ');
    const consolidatedMessage =
      reportedByRole === 'user'
        ? `Bus ${busCode} (Driver: ${driverName}, Route: ${routeName}) is facing an issue near "${stopName}" — ${currentCount} out of 10 passengers on Bus ${busCode} (${passengerNamesList}) reported an emergency within 15 minutes.`
        : reason ||
          `Bus ${busCode} (Driver: ${driverName}, Route: ${routeName}) is facing an emergency issue near "${stopName}" (Reported directly by Driver ${driverName}).`;

    const notif = await db.createNotification({
      title: `🚨 Bus ${busCode} Emergency Issue (${reportedByRole === 'user' ? `${currentCount}/10 Passengers` : 'Driver Alert'})`,
      message: consolidatedMessage,
      type: 'off_route',
      shuttle_id: sId,
      organization_name: shuttle?.organization_name
    });

    // Resolve Organization Admin email addresses for Emergency Alert Email dispatch
    let emailDelivery = null;
    try {
      const orgName =
        shuttle?.organization_name ||
        store.settings?.organization_name ||
        'Sairam Engineering College';
      const orgSettings = await db.getSettings(orgName);
      const isRealAdminEmail = (em) =>
        Boolean(
          em &&
            String(em).includes('@') &&
            !String(em).toLowerCase().endsWith('@shuttletrack.com') &&
            !String(em).toLowerCase().endsWith('@shuttletracker.com')
        );

      const candidateAdminEmails = [];
      if (isRealAdminEmail(orgSettings?.admin_profile_email)) {
        candidateAdminEmails.push(orgSettings.admin_profile_email);
      }
      if (isRealAdminEmail(store.settings?.admin_profile_email)) {
        candidateAdminEmails.push(store.settings.admin_profile_email);
      }
      store.users
        .filter((u) => u.role === 'admin' && isRealAdminEmail(u.email))
        .forEach((u) => candidateAdminEmails.push(u.email));

      // If Admin logged in with placeholder admin@shuttletrack.com / admin@shuttletracker.com,
      // also include registered real organization emails & system admin email so the alert arrives in the inbox
      store.users
        .filter((u) => matchesOrg(u.organization_name, orgName) && isRealAdminEmail(u.email))
        .forEach((u) => candidateAdminEmails.push(u.email));
      candidateAdminEmails.push('cleancodeuniverse@gmail.com');

      const { sendAdminEmergencyEmail } = require('../services/otpService');
      emailDelivery = await sendAdminEmergencyEmail({
        adminEmails: candidateAdminEmails,
        adminName: orgSettings?.admin_profile_name || 'Administrator',
        busCode,
        shuttleName: shuttle?.name || `Shuttle ${busCode}`,
        vehicleNumber: shuttle?.vehicle_number || '',
        driverName,
        routeName,
        stopName,
        reportedByRole,
        reportedByName: reportedByName || driverName,
        passengerCount: currentCount,
        maxPassengerCount: maxPassengerReports,
        passengerNames: passengerNamesList,
        reason: consolidatedMessage,
        organizationName: orgName
      });
    } catch (emgEmailErr) {
      console.warn('Emergency email dispatch notice:', emgEmailErr.message);
    }

    return {
      alreadyReportedByPassenger: false,
      alreadyNotified: false,
      thresholdReached: true,
      currentCount,
      maxCount: maxPassengerReports,
      requiredCount: requiredPassengerReports,
      passengerEmergencyReports: existingReports,
      notification: notif,
      shuttleId: sId,
      busCode,
      driverName,
      routeName,
      stopName,
      stoppedMinutes: mins,
      emailDeliveredVia: emailDelivery?.deliveredVia || null,
      emailRelayPayload: emailDelivery?.relayPayload || null,
      adminEmailRecipients: emailDelivery?.recipients || []
    };
  },

  markScheduleArrivalExceeded: async (scheduleId, customReason = '') => {
    const sched = store.schedules.find((s) => s.id === Number(scheduleId));
    if (!sched) return null;
    return await db.recordDriverDestinationArrival(sched.shuttle_id, 5);
  },

  // Multi-Organization System Settings (Organization Name, Sample Passenger ID Card Format, Admin Profile, Speed Limit, Delay Threshold)
  getSettings: async (orgName = null) => {
    if (!store.organization_settings) {
      store.organization_settings = {};
    }
    if (orgName) {
      const targetKey = normalizeOrgKey(orgName);
      // Look for exact or fuzzy matching organization settings
      const matchingEntry = Object.entries(store.organization_settings).find(([k, val]) =>
        matchesOrg(val?.organization_name || k, orgName)
      );
      if (matchingEntry) {
        return matchingEntry[1];
      }
      if (matchesOrg(store.settings?.organization_name, orgName)) {
        return store.settings;
      }
      // Return default settings initialized for this organization
      return {
        ...store.settings,
        organization_name: String(orgName).trim(),
        sample_id_card_url: store.organization_settings[targetKey]?.sample_id_card_url || '',
        sample_id_ocr_text: store.organization_settings[targetKey]?.sample_id_ocr_text || '',
        sample_id_format_keywords: store.organization_settings[targetKey]?.sample_id_format_keywords || [
          'id',
          'student',
          'register',
          'department',
          'roll'
        ]
      };
    }
    return store.settings;
  },

  getAllOrganizations: async () => {
    const orgMap = new Map();
    const registerOrg = (name, settingsObj = null) => {
      const clean = String(name || '').trim();
      if (!clean) return;
      const key = normalizeOrgKey(clean);
      if (!key) return;
      if (!orgMap.has(key)) {
        orgMap.set(key, {
          organization_name: clean,
          has_sample_id: Boolean(settingsObj?.sample_id_card_url),
          sample_id_format_keywords: settingsObj?.sample_id_format_keywords || [
            'id',
            'student',
            'register',
            'department',
            'roll'
          ],
          admin_email: settingsObj?.admin_profile_email || ''
        });
      } else if (settingsObj?.sample_id_card_url) {
        const existing = orgMap.get(key);
        existing.has_sample_id = true;
        existing.sample_id_format_keywords =
          settingsObj.sample_id_format_keywords || existing.sample_id_format_keywords;
      }
    };

    registerOrg(store.settings?.organization_name, store.settings);
    if (store.organization_settings) {
      Object.values(store.organization_settings).forEach((s) => registerOrg(s?.organization_name, s));
    }
    store.users
      .filter((u) => u.role === 'admin')
      .forEach((u) => registerOrg(u.organization_name || store.settings?.organization_name));
    store.shuttles.forEach((s) => registerOrg(s.organization_name));

    return Array.from(orgMap.values());
  },

  updateSettings: async (newSettings, orgName = null) => {
    const resolvedOrgName = String(
      newSettings.organization_name ||
        orgName ||
        store.settings?.organization_name ||
        'Sairam Engineering College'
    ).trim();
    const orgKey = normalizeOrgKey(resolvedOrgName);
    if (!store.organization_settings) {
      store.organization_settings = {};
    }
    if (!store.org_settings) {
      store.org_settings = {};
    }
    const existingOrgSettings =
      store.organization_settings[orgKey] ||
      store.org_settings[orgKey] ||
      (matchesOrg(store.settings?.organization_name, resolvedOrgName) ? store.settings : null);
    const baseSettings = existingOrgSettings || {
      organization_name: resolvedOrgName,
      speed_limit: 35,
      delay_threshold: 5,
      google_maps_key: store.settings?.google_maps_key || process.env.GOOGLE_MAPS_API_KEY || '',
      sample_id_card_url: '',
      sample_id_ocr_text: '',
      sample_id_format_keywords: [],
      admin_profile_name: 'System Administrator',
      admin_profile_email: 'admin@shuttletrack.com'
    };

    const updatedOrgSettings = {
      ...baseSettings,
      organization_name: resolvedOrgName,
      ...(newSettings.speed_limit !== undefined ? { speed_limit: Number(newSettings.speed_limit) || 35 } : {}),
      ...(newSettings.delay_threshold !== undefined
        ? { delay_threshold: Number(newSettings.delay_threshold) || 5 }
        : {}),
      ...(newSettings.google_maps_key !== undefined
        ? { google_maps_key: String(newSettings.google_maps_key).trim() }
        : {}),
      ...(newSettings.sample_id_card_url !== undefined
        ? { sample_id_card_url: String(newSettings.sample_id_card_url || '') }
        : {}),
      ...(newSettings.sample_id_ocr_text !== undefined
        ? { sample_id_ocr_text: String(newSettings.sample_id_ocr_text || '') }
        : {}),
      ...(newSettings.sample_id_format_keywords !== undefined && Array.isArray(newSettings.sample_id_format_keywords)
        ? { sample_id_format_keywords: newSettings.sample_id_format_keywords }
        : {}),
      ...(newSettings.admin_profile_name !== undefined
        ? { admin_profile_name: String(newSettings.admin_profile_name).trim() }
        : {}),
      ...(newSettings.admin_profile_email !== undefined
        ? { admin_profile_email: String(newSettings.admin_profile_email).trim() }
        : {})
    };

    store.organization_settings[orgKey] = updatedOrgSettings;
    store.org_settings[orgKey] = updatedOrgSettings;
    store.settings = updatedOrgSettings;

    if (isPostgresConnected && pool) {
      try {
        await pool.query(
          `INSERT INTO system_settings (id, settings_json, updated_at)
           VALUES (1, $1, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE
             SET settings_json = EXCLUDED.settings_json,
                 updated_at = CURRENT_TIMESTAMP`,
          [JSON.stringify(store.settings)]
        );
        await pool.query(
          `INSERT INTO organization_settings (org_key, organization_name, settings_json, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (org_key) DO UPDATE
             SET organization_name = EXCLUDED.organization_name,
                 settings_json = EXCLUDED.settings_json,
                 updated_at = CURRENT_TIMESTAMP`,
          [orgKey, resolvedOrgName, JSON.stringify(updatedOrgSettings)]
        );
      } catch (err) {
        console.warn('Postgres updateSettings sync warning:', err.message);
      }
    }

    return updatedOrgSettings;
  },

  // Location Updates
  recordLocationUpdate: async (updateData) => {
    const rec = {
      id: store.location_updates.length + 1,
      ...updateData,
      recorded_at: new Date().toISOString()
    };
    store.location_updates.push(rec);
    if (store.location_updates.length > 2000) {
      store.location_updates.splice(0, 500);
    }
    return rec;
  },

  // Dashboard Stats (scoped by organization_name when provided)
  getDashboardStats: async (orgName = null) => {
    const shuttlesList = orgName
      ? store.shuttles.filter((s) => matchesOrg(s.organization_name, orgName))
      : store.shuttles;
    const driversList = orgName
      ? store.drivers.filter((d) => matchesOrg(d.organization_name, orgName))
      : store.drivers;

    const totalShuttles = shuttlesList.length;
    const activeShuttles = shuttlesList.filter((s) => s.status === 'on_trip').length;
    const activeDrivers = driversList.filter(
      (d) => d.is_active !== false && Boolean(d.has_logged_in) === true
    ).length;
    const delayedShuttles = shuttlesList.filter((s) => s.status === 'delayed').length;

    return {
      totalShuttles,
      activeShuttles,
      activeDrivers,
      delayedShuttles,
      onTimeRate: '94.2%',
      averageWaitTime: '4.8 min',
      fleetHealth: '98.5%'
    };
  },

  geocodeLocation
};

module.exports = db;
