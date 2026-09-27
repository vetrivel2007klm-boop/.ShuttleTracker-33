import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useTheme } from '../../context/ThemeContext';
import { Layers, AlertCircle, Key, Check, Car } from 'lucide-react';
import Button from '../common/Button';

// Google Maps Night / Dark Mode Style JSON
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] }
];

export const GoogleMapView = ({
  shuttles = [],
  stops = [],
  selectedShuttleId = null,
  onSelectShuttle,
  onMapClick,
  center = { lat: 12.9782, lng: 77.6035 },
  zoom = 15,
  className = 'h-full min-h-[450px]',
  apiKey: propApiKey
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());
  const stopMarkersRef = useRef([]);
  const polylineRef = useRef(null);
  const infoWindowRef = useRef(null);
  const trafficLayerRef = useRef(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const { darkMode } = useTheme();
  const [loadError, setLoadError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [customKey, setCustomKey] = useState(() => {
    return propApiKey || localStorage.getItem('shuttle_google_maps_key') || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  });
  const [isKeyInputOpen, setIsKeyInputOpen] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');

  // Auto-load Google Maps API Key from backend Admin Settings if not already in localStorage
  useEffect(() => {
    if (customKey) return;
    fetch('/api/stats/settings')
      .then((r) => r.json())
      .then((res) => {
        const backendKey = res?.data?.google_maps_key;
        if (backendKey && backendKey.trim()) {
          localStorage.setItem('shuttle_google_maps_key', backendKey.trim());
          setCustomKey(backendKey.trim());
        }
      })
      .catch(() => {});
  }, [customKey]);

  // Safe SVG Shuttle Icon Generator for Google Maps
  const createShuttleMarkerIcon = (shuttle, isSelected) => {
    if (!window.google?.maps) return undefined;
    const isDelayed = shuttle.status === 'delayed';
    const bg = isDelayed ? '#F59E0B' : '#2563EB';

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="46" height="52" viewBox="0 0 46 52">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.35"/>
          </filter>
        </defs>
        <path d="M23 0 C10.3 0 0 10.3 0 23 C0 35.5 21 51 23 52 C25 51 46 35.5 46 23 C46 10.3 35.7 0 23 0 Z" fill="${bg}" filter="url(#shadow)"/>
        <circle cx="23" cy="20" r="16" fill="#ffffff" opacity="0.95"/>
        <g transform="translate(14, 11) scale(0.75)" stroke="#0F172A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 6v6m7-6v6m-13 0h19.6m-3.6 6h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 00-2 2v10h3"/>
          <circle cx="7" cy="18" r="2"/>
          <path d="M9 18h5"/>
          <circle cx="16" cy="18" r="2"/>
        </g>
        <rect x="10" y="32" width="26" height="12" rx="4" fill="#0F172A"/>
        <text x="23" y="41" fill="#ffffff" font-size="8.5" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">${shuttle.code}</text>
      </svg>
    `;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(46, 52),
      anchor: new window.google.maps.Point(23, 52)
    };
  };

  // Safe SVG Stop Pin Generator for Google Maps
  const createStopMarkerIcon = (number, name) => {
    if (!window.google?.maps) return undefined;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38">
        <path d="M16 0 C7.2 0 0 7.2 0 16 C0 26 15 37.5 16 38 C17 37.5 32 26 32 16 C32 7.2 24.8 0 16 0 Z" fill="#0F172A"/>
        <circle cx="16" cy="14" r="10" fill="#2563EB"/>
        <text x="16" y="18" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">${number}</text>
      </svg>
    `;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(32, 38),
      anchor: new window.google.maps.Point(16, 38)
    };
  };

  // Load Google Maps API Script
  useEffect(() => {
    let isMounted = true;
    const effectiveKey = customKey || '';

    // If no key provided, don't trigger broken Google script
    if (!effectiveKey) {
      setLoadError('Please set your Google Cloud Maps API key to activate Google satellite/street view.');
      setIsLoaded(false);
      return;
    }

    try {
      const loader = new Loader({
        apiKey: effectiveKey,
        version: 'weekly',
        libraries: ['places', 'geometry'],
      });

      loader
        .load()
        .then((google) => {
          if (!isMounted || !mapRef.current) return;

          const map = new google.maps.Map(mapRef.current, {
            center: { lat: center.lat || center[0] || 12.9782, lng: center.lng || center[1] || 77.6035 },
            zoom: zoom || 15,
            styles: darkMode ? darkMapStyle : [],
            scrollwheel: false,
            gestureHandling: 'cooperative',
            mapTypeControl: true,
            mapTypeControlOptions: {
              position: google.maps.ControlPosition.TOP_RIGHT,
              style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
            },
            streetViewControl: false,
            fullscreenControl: true,
          });

          // Allow clicking anywhere on Google Map to pick stop coordinates when adding stops/routes
          map.addListener('click', (e) => {
            if (onMapClickRef.current && e.latLng) {
              onMapClickRef.current(
                Number(e.latLng.lat().toFixed(5)),
                Number(e.latLng.lng().toFixed(5))
              );
            }
          });

          const trafficLayer = new google.maps.TrafficLayer();
          trafficLayerRef.current = trafficLayer;

          infoWindowRef.current = new google.maps.InfoWindow();
          mapInstanceRef.current = map;
          setIsLoaded(true);
          setLoadError(null);
        })
        .catch((err) => {
          if (isMounted) {
            setLoadError('Google Maps API Key not verified. Switch to Live Radar view.');
            setIsLoaded(false);
          }
        });
    } catch (e) {
      if (isMounted) {
        setLoadError(e.message);
        setIsLoaded(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [customKey]);

  // Update Theme styles
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;
    mapInstanceRef.current.setOptions({
      styles: darkMode ? darkMapStyle : []
    });
  }, [darkMode]);

  // Toggle Traffic Layer
  const toggleTraffic = () => {
    if (!mapInstanceRef.current || !trafficLayerRef.current) return;
    if (showTraffic) {
      trafficLayerRef.current.setMap(null);
      setShowTraffic(false);
    } else {
      trafficLayerRef.current.setMap(mapInstanceRef.current);
      setShowTraffic(true);
    }
  };

  // Render / Update Route Polylines and Stop Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps || !isLoaded) return;
    const map = mapInstanceRef.current;
    const google = window.google;

    stopMarkersRef.current.forEach(m => m.setMap(null));
    stopMarkersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (stops && stops.length > 0) {
      const validStops = stops.filter((s) => s.latitude && s.longitude);
      const pathCoordinates = validStops.map(s => ({ lat: Number(s.latitude), lng: Number(s.longitude) }));

      const routePolyline = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#2563EB',
        strokeOpacity: 0.85,
        strokeWeight: 5,
        map
      });
      polylineRef.current = routePolyline;

      const bounds = new google.maps.LatLngBounds();

      validStops.forEach((stop, index) => {
        const pos = { lat: Number(stop.latitude), lng: Number(stop.longitude) };
        bounds.extend(pos);
        const marker = new google.maps.Marker({
          position: pos,
          map,
          title: stop.name,
          icon: createStopMarkerIcon(index + 1, stop.name)
        });

        marker.addListener('click', () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(`
              <div style="padding: 6px; font-family: system-ui, sans-serif; color: #0F172A;">
                <div style="font-weight: 800; font-size: 13px;">#${index + 1} ${stop.name}</div>
                <div style="font-size: 11px; color: #64748B; margin-top: 2px;">${stop.landmark || 'Campus Transit Bay'}</div>
              </div>
            `);
            infoWindowRef.current.open(map, marker);
          }
        });

        stopMarkersRef.current.push(marker);
      });

      if (validStops.length > 1) {
        map.fitBounds(bounds);
      }
    }
  }, [stops, isLoaded]);

  // Real-time Update Shuttle Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps || !isLoaded) return;
    const map = mapInstanceRef.current;
    const google = window.google;
    const markerMap = markersRef.current;

    shuttles.forEach((shuttle) => {
      const lat = Number(shuttle.current_lat) || 12.9752;
      const lng = Number(shuttle.current_lng) || 77.6001;
      const isSelected = selectedShuttleId && Number(shuttle.id) === Number(selectedShuttleId);

      const markerContent = `
        <div style="padding: 10px; font-family: system-ui, sans-serif; color: #0F172A; min-width: 180px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <strong style="font-size: 14px; font-weight: 800;">${shuttle.code} • ${shuttle.name}</strong>
          </div>
          <div style="font-size: 11px; color: #2563EB; font-weight: 700; margin-bottom: 4px;">
            Next Stop: ${shuttle.next_stop_name || 'Main Gate'}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 4px;">
            <span>ETA: <b>${shuttle.eta_minutes || 4} min</b></span>
            <span>Speed: <b>${Math.round(shuttle.speed || 0)} km/h</b></span>
          </div>
        </div>
      `;

      if (markerMap.has(shuttle.id)) {
        const existingMarker = markerMap.get(shuttle.id);
        existingMarker.setPosition({ lat, lng });
        const icon = createShuttleMarkerIcon(shuttle, isSelected);
        if (icon) existingMarker.setIcon(icon);
      } else {
        const icon = createShuttleMarkerIcon(shuttle, isSelected);
        const newMarker = new google.maps.Marker({
          position: { lat, lng },
          map,
          title: `${shuttle.code} - ${shuttle.name}`,
          icon,
          optimized: false
        });

        newMarker.addListener('click', () => {
          if (onSelectShuttle) onSelectShuttle(shuttle);
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(markerContent);
            infoWindowRef.current.open(map, newMarker);
          }
        });

        markerMap.set(shuttle.id, newMarker);
      }
    });

    if (selectedShuttleId) {
      const selected = shuttles.find(s => Number(s.id) === Number(selectedShuttleId));
      if (selected && selected.current_lat && selected.current_lng) {
        map.panTo({ lat: Number(selected.current_lat), lng: Number(selected.current_lng) });
      }
    }
  }, [shuttles, selectedShuttleId, isLoaded]);

  const handleSaveKey = (e) => {
    e.preventDefault();
    if (tempKeyInput.trim()) {
      localStorage.setItem('shuttle_google_maps_key', tempKeyInput.trim());
      setCustomKey(tempKeyInput.trim());
      setIsKeyInputOpen(false);
    }
  };

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden shadow-subtle border border-slate-200/90 dark:border-slate-800 ${className}`}>
      {/* Map DOM Element */}
      <div ref={mapRef} className="w-full h-full min-h-[420px]" />

      {/* Fallback Notice if no API Key set */}
      {loadError && !isLoaded && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 text-white">
          <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
          <h4 className="text-base font-bold">Google Maps API Setup</h4>
          <p className="text-xs text-slate-300 max-w-sm mt-1 mb-4 leading-relaxed">
            {loadError}
          </p>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              icon={Key}
              onClick={() => {
                setTempKeyInput(customKey);
                setIsKeyInputOpen(true);
              }}
            >
              Enter API Key
            </Button>
            <button
              onClick={() => {
                localStorage.setItem('shuttle_map_provider', 'vector');
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors"
            >
              Use Live Radar (No Key Required)
            </button>
          </div>
        </div>
      )}

      {/* Floating Google Maps HUD Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md text-xs flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-navy-900 dark:text-white">Google Maps Live</span>
        </div>

        {isLoaded && (
          <button
            onClick={toggleTraffic}
            type="button"
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold shadow-md transition-all flex items-center gap-1.5 backdrop-blur-md ${
              showTraffic
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Traffic {showTraffic ? 'ON' : 'OFF'}</span>
          </button>
        )}

        <button
          onClick={() => {
            setTempKeyInput(customKey);
            setIsKeyInputOpen(!isKeyInputOpen);
          }}
          type="button"
          className="px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-md text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-brand-500 flex items-center gap-1.5"
        >
          <Key className="w-3.5 h-3.5" />
          <span>{customKey ? 'Key Active' : 'Set API Key'}</span>
        </button>
      </div>

      {/* Key Input Dropdown Popover */}
      {isKeyInputOpen && (
        <div className="absolute top-16 left-4 z-30 w-80 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <h4 className="text-xs font-bold text-navy-900 dark:text-white mb-1">
            Google Maps API Key
          </h4>
          <p className="text-[11px] text-slate-400 mb-3">
            Enter your Google Cloud Maps JavaScript API key:
          </p>
          <form onSubmit={handleSaveKey} className="space-y-3">
            <input
              type="text"
              placeholder="AIzaSy..."
              value={tempKeyInput}
              onChange={(e) => setTempKeyInput(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsKeyInputOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500"
              >
                Cancel
              </button>
              <Button type="submit" size="sm" icon={Check}>
                Save Key
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default GoogleMapView;
