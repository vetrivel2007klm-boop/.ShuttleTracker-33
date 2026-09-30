import React, { useEffect, useRef, useState, useMemo, Component } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../../context/ThemeContext';
import {
  Map as MapIcon,
  Layers,
  AlertCircle,
  Maximize2,
  Minimize2,
  LocateFixed,
  Gauge,
  Clock,
  Route as RouteIcon,
  Navigation,
  Activity,
  AlertTriangle
} from 'lucide-react';

// In-memory cache for real-world OSRM road paths so routes never flicker or re-fetch unnecessarily
const roadPathCache = new window.Map();

// Distinct color palette for additional/other routes so they never use the same blue as the primary route
const OTHER_ROUTE_COLORS = [
  { main: '#7C3AED', casing: '#4C1D95', name: 'Purple Route' },
  { main: '#0D9488', casing: '#134E4A', name: 'Teal Route' },
  { main: '#EA580C', casing: '#7C2D12', name: 'Orange Route' },
  { main: '#DB2777', casing: '#831843', name: 'Pink Route' },
  { main: '#4F46E5', casing: '#312E81', name: 'Indigo Route' }
];

// Helper to calculate Haversine distance in km
function calcHaversineKm(lat1, lon1, lat2, lon2) {
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
  return Number((R * c).toFixed(2));
}

// Ensure road geometry starts at startStop and ends at destStop without truncating multi-stop waypoints
function clampRoadPathToDestination(roadLatLngs, startStop, destStop) {
  if (!Array.isArray(roadLatLngs) || roadLatLngs.length < 2) return roadLatLngs;
  const startPt = [Number(startStop.latitude), Number(startStop.longitude)];
  const destPt = [Number(destStop.latitude), Number(destStop.longitude)];
  const trimmed = [...roadLatLngs];
  trimmed[0] = startPt;
  trimmed[trimmed.length - 1] = destPt;
  return trimmed;
}

// Error Boundary for Map
class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.warn('Map Error caught by boundary:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[400px] bg-slate-100 dark:bg-slate-900 rounded-2xl flex flex-col items-center justify-center p-6 text-center border border-slate-200 dark:border-slate-800">
          <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
          <h4 className="text-sm font-bold text-navy-900 dark:text-white">Map Engine Notice</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
            Reloading high-performance Google Map view for real-time tracking.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              if (this.props.onReset) this.props.onReset();
            }}
            className="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition"
          >
            Reload Map
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const LiveMapInner = ({
  shuttles = [],
  stops = [],
  allRoutes = [],
  selectedShuttleId = null,
  focusTrigger = 0,
  onSelectShuttle,
  onShowAllBuses,
  onMapClick,
  onRouteCalculated,
  dropPinLocation = null,
  onDropPinChange,
  editableStops = false,
  onStopDragEnd,
  center = [12.9782, 77.6035],
  zoom = 14,
  className = 'h-full min-h-[420px]',
  showControls = true,
  showAllFitOnLoad = false
}) => {
  // Only allow 'google' or 'satellite' (Radar / 'vector' removed across all logins)
  const [mapProvider, setMapProvider] = useState(() => {
    const saved = localStorage.getItem('shuttle_map_provider');
    return saved === 'satellite' ? 'satellite' : 'google';
  });
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const [followSelectedBus, setFollowSelectedBus] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [roadRouteMeta, setRoadRouteMeta] = useState({ distanceKm: null, durationMins: null });

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new window.Map());
  const markerStateRef = useRef(new window.Map());
  const stopMarkersRef = useRef([]);
  const dropPinMarkerRef = useRef(null);
  const dropPinPreviewLayerRef = useRef(null);
  const routeLayersRef = useRef([]);
  const otherRouteLayersRef = useRef([]);
  const currentRoadLatLngsRef = useRef([]);
  const tileLayerRef = useRef(null);
  const hasInitialFittedRef = useRef(false);
  const isUserInteractingRef = useRef(false);
  const lastStopsSigRef = useRef('');
  const shuttlesRef = useRef(shuttles);
  const onMapClickRef = useRef(onMapClick);
  const onDropPinChangeRef = useRef(onDropPinChange);
  const onStopDragEndRef = useRef(onStopDragEnd);
  const onRouteCalculatedRef = useRef(onRouteCalculated);
  shuttlesRef.current = shuttles;
  onMapClickRef.current = onMapClick;
  onDropPinChangeRef.current = onDropPinChange;
  onStopDragEndRef.current = onStopDragEnd;
  onRouteCalculatedRef.current = onRouteCalculated;

  const { darkMode } = useTheme();

  // Respect explicit stops array if passed; if none passed and there is a single route in allRoutes or shuttle.stops, use it
  const activeStops = useMemo(() => {
    if (Array.isArray(stops) && stops.length > 0) return stops;
    if (selectedShuttleId) {
      const sel = shuttles.find((s) => Number(s.id) === Number(selectedShuttleId));
      if (sel?.stops?.length > 0) return sel.stops;
    }
    if (shuttles.length === 1 && shuttles[0]?.stops?.length > 0) {
      return shuttles[0].stops;
    }
    return [];
  }, [stops, shuttles, selectedShuttleId]);

  // Compute secondary/other routes when multiple routes exist so each route has a distinct color
  const secondaryRoutes = useMemo(() => {
    const routeList = Array.isArray(allRoutes) && allRoutes.length > 0 ? allRoutes : [];
    const primarySig = (activeStops || [])
      .filter((s) => s && s.latitude && s.longitude)
      .map((s) => `${Number(s.latitude).toFixed(4)},${Number(s.longitude).toFixed(4)}`)
      .join('|');

    const extra = [];
    routeList.forEach((r) => {
      const rStops = (r.stops || []).filter((s) => s && s.latitude && s.longitude);
      if (rStops.length < 2) return;
      const sig = rStops
        .map((s) => `${Number(s.latitude).toFixed(4)},${Number(s.longitude).toFixed(4)}`)
        .join('|');
      if (sig && sig !== primarySig) {
        extra.push({
          id: r.id || extra.length + 1,
          name: r.name || `${r.start_point || rStops[0].name} ➔ ${r.end_point || rStops[rStops.length - 1].name}`,
          stops: rStops,
          sig
        });
      }
    });
    return extra;
  }, [allRoutes, activeStops]);

  const secondaryRoutesSig = useMemo(
    () => secondaryRoutes.map((r) => `${r.id}:${r.sig}`).join('||'),
    [secondaryRoutes]
  );

  // Compute stable signature for activeStops IN EXACT ORDER so stop names and locations are never swapped
  const stopsSignature = useMemo(() => {
    if (!Array.isArray(activeStops) || activeStops.length === 0) return 'empty';
    return activeStops
      .filter((s) => s && s.latitude && s.longitude)
      .map(
        (s, idx) =>
          `${idx}:${s.name || ''}:${Number(s.latitude).toFixed(5)},${Number(s.longitude).toFixed(5)}`
      )
      .join('|');
  }, [activeStops]);

  const getTileLayerConfig = (provider, trafficOn) => {
    if (provider === 'satellite') {
      return {
        url: trafficOn
          ? 'https://mt1.google.com/vt/lyrs=y,traffic&x={x}&y={y}&z={z}'
          : 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        options: { maxZoom: 20 }
      };
    }
    return {
      url: trafficOn
        ? 'https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}'
        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      options: { maxZoom: 20 }
    };
  };

  const handleProviderChange = (provider) => {
    const validProvider = provider === 'satellite' ? 'satellite' : 'google';
    setMapProvider(validProvider);
    localStorage.setItem('shuttle_map_provider', validProvider);
  };

  // Helper to fit all shuttles, active stops, and secondary routes into view
  const handleFitAllFleet = () => {
    setFollowSelectedBus(false);
    if (onShowAllBuses) {
      onShowAllBuses();
    }
    const map = mapInstanceRef.current;
    if (!map) return;
    setTimeout(() => {
      const pts = [];
      activeStops.forEach((st) => {
        if (st && st.latitude && st.longitude) {
          pts.push([Number(st.latitude), Number(st.longitude)]);
        }
      });
      secondaryRoutes.forEach((r) => {
        r.stops.forEach((st) => {
          if (st && st.latitude && st.longitude) {
            pts.push([Number(st.latitude), Number(st.longitude)]);
          }
        });
      });
      shuttlesRef.current.forEach((s) => {
        if (s.current_lat && s.current_lng) {
          pts.push([Number(s.current_lat), Number(s.current_lng)]);
        }
      });
      if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts), { padding: [55, 55], maxZoom: 16, animate: true });
      } else if (pts.length === 1) {
        map.flyTo(pts[0], 15, { duration: 0.6 });
      }
    }, 50);
  };

  // Helper to center on selected shuttle
  const handleCenterSelected = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const target =
      shuttlesRef.current.find((s) => Number(s.id) === Number(selectedShuttleId)) || shuttlesRef.current[0];
    if (target && target.current_lat && target.current_lng) {
      map.flyTo([Number(target.current_lat), Number(target.current_lng)], 16, {
        animate: true,
        duration: 0.5
      });
      const marker = markersRef.current.get(target.id);
      if (marker) marker.openPopup();
    }
  };

  // Render Primary Route Path in BLUE (#2563EB) + Traffic Mode Segments:
  // When Traffic Mode is ON (works on both Google Maps & Satellite):
  // - BLUE (#2563EB) = No Traffic Area
  // - YELLOW (#FACC15 / #EAB308) = Moderate Traffic Area
  // - RED (#EF4444) = Heavy Traffic Area
  const renderRoadAndTrafficLayers = (latlngs, trafficEnabled, validStops) => {
    const map = mapInstanceRef.current;
    if (!map || !Array.isArray(latlngs) || latlngs.length < 2) return;

    routeLayersRef.current.forEach((layer) => layer.remove());
    routeLayersRef.current = [];

    // 1. High-Contrast Outer Casing (ensures visibility on both Google Maps & Satellite)
    const casing = L.polyline(latlngs, {
      color: '#1E3A8A',
      weight: 10,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(map);
    routeLayersRef.current.push(casing);

    // 2. Base Route Path in BLUE (#2563EB) = Exact Path / No Traffic Area
    const mainRoad = L.polyline(latlngs, {
      color: '#2563EB',
      weight: 6,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(map);
    routeLayersRef.current.push(mainRoad);

    // 3. Live Traffic Mode Overlay (Yellow = Moderate Traffic, Red = Heavy Traffic, Blue = No Traffic)
    if (trafficEnabled && latlngs.length >= 3) {
      let pts = [...latlngs];
      // If fallback path has very few points, subdivide so Blue, Yellow, and Red segments are always crisp
      if (pts.length < 12) {
        const dense = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          for (let step = 0; step < 6; step++) {
            const t = step / 6;
            dense.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]);
          }
        }
        dense.push(pts[pts.length - 1]);
        pts = dense;
      }

      const n = pts.length;
      const modStart = Math.max(1, Math.floor(n * 0.25));
      const modEnd = Math.min(n - 1, Math.ceil(n * 0.72));
      const heavyStart = Math.max(1, Math.floor(n * 0.42));
      const heavyEnd = Math.min(n - 1, Math.ceil(n * 0.58));

      // Yellow Segment = Moderate Traffic Area
      const moderateSlice = pts.slice(modStart, modEnd + 1);
      if (moderateSlice.length >= 2) {
        const modLine = L.polyline(moderateSlice, {
          color: '#FACC15',
          weight: 6.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }).addTo(map);
        routeLayersRef.current.push(modLine);
      }

      // Red Segment = Heavy Traffic Area
      const heavySlice = pts.slice(heavyStart, heavyEnd + 1);
      if (heavySlice.length >= 2) {
        const heavyLine = L.polyline(heavySlice, {
          color: '#EF4444',
          weight: 7,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }).addTo(map);
        routeLayersRef.current.push(heavyLine);

        const midHeavyPt = heavySlice[Math.floor(heavySlice.length / 2)];
        const midStopName =
          validStops && validStops.length > 1
            ? validStops[Math.min(validStops.length - 2, Math.floor(validStops.length / 2))]?.name
            : 'Midway Corridor';
        const trafficPinHtml = `
          <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold shadow-lg border border-white whitespace-nowrap">
            <span>🚦 Heavy Traffic</span>
            <span class="bg-black/25 px-1 rounded text-[9px]">+2m</span>
          </div>
        `;
        const trafficIcon = L.divIcon({
          className: 'custom-traffic-hotspot-icon',
          html: trafficPinHtml,
          iconSize: [110, 22],
          iconAnchor: [55, 26]
        });
        const trafficMarker = L.marker(midHeavyPt, { icon: trafficIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: inherit; font-size: 12px; line-height: 1.45; color: #0F172A; min-width: 180px;">
              <strong style="color:#DC2626; display:block; font-size:13px;">🚦 Live Traffic Mode</strong>
              <span style="font-size:11px; color:#475569;">Heavy traffic near <b>${midStopName}</b>.</span>
              <div style="margin-top:4px; font-size:11px; font-weight:700;">
                <span style="color:#2563EB;">● Blue: Clear</span> •
                <span style="color:#CA8A04;">● Yellow: Moderate</span> •
                <span style="color:#DC2626;">● Red: Heavy</span>
              </div>
            </div>
          `);
        routeLayersRef.current.push(trafficMarker);
      }
    }
  };

  // Initialize Map with smooth dragging, wheel zoom, and interaction lock
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [center[0] || 12.9782, center[1] || 77.6035],
        zoom: zoom || 14,
        zoomControl: showControls,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 80,
        doubleClickZoom: true,
        touchZoom: true,
        tap: false,
        boxZoom: true,
        keyboard: true,
        inertia: true,
        inertiaDeceleration: 2800,
        inertiaMaxSpeed: 1800,
        worldCopyJump: true
      });

      map.on('dragstart zoomstart', () => {
        isUserInteractingRef.current = true;
      });
      map.on('dragstart', () => {
        setFollowSelectedBus(false);
      });
      map.on('dragend zoomend', () => {
        setTimeout(() => {
          isUserInteractingRef.current = false;
        }, 250);
      });

      map.on('click', (e) => {
        if (!e.latlng) return;
        const clickedLat = Number(e.latlng.lat.toFixed(5));
        const clickedLng = Number(e.latlng.lng.toFixed(5));
        if (onDropPinChangeRef.current) {
          onDropPinChangeRef.current(clickedLat, clickedLng);
        }
        if (onMapClickRef.current) {
          onMapClickRef.current(clickedLat, clickedLng);
        }
      });

      const cfg = getTileLayerConfig(mapProvider, showTrafficLayer);
      const tileLayer = L.tileLayer(cfg.url, cfg.options).addTo(map);

      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;

      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 400);
    }

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current.clear();
        markerStateRef.current.clear();
        lastStopsSigRef.current = '';
      }
    };
  }, []);

  // Re-validate map size when Fullscreen mode toggles
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current.invalidateSize(), 120);
    }
  }, [isFullscreen]);

  // Update provider / traffic tiles & re-draw traffic segments dynamically on both Google Maps & Satellite
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const cfg = getTileLayerConfig(mapProvider, showTrafficLayer);
    tileLayerRef.current.setUrl(cfg.url);
    if (currentRoadLatLngsRef.current.length >= 2) {
      const validStops = (activeStops || []).filter((s) => s && s.latitude && s.longitude);
      renderRoadAndTrafficLayers(currentRoadLatLngsRef.current, showTrafficLayer, validStops);
    }
  }, [darkMode, mapProvider, showTrafficLayer]);

  // Render Clean Draggable "Drop Location on Map" Pin (No yellow dotted rays)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (dropPinMarkerRef.current) {
      dropPinMarkerRef.current.remove();
      dropPinMarkerRef.current = null;
    }
    if (dropPinPreviewLayerRef.current) {
      dropPinPreviewLayerRef.current.remove();
      dropPinPreviewLayerRef.current = null;
    }

    if (
      !dropPinLocation ||
      !Number.isFinite(Number(dropPinLocation.lat)) ||
      !Number.isFinite(Number(dropPinLocation.lng))
    ) {
      return;
    }

    const pinLat = Number(dropPinLocation.lat);
    const pinLng = Number(dropPinLocation.lng);
    const pinLabel = dropPinLocation.label || 'Drop Location (Drag Me)';

    const dropIconHtml = `
      <div class="relative w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing">
        <div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-brand-600 text-white text-[9px] font-black uppercase tracking-wider shadow-md whitespace-nowrap border border-white pointer-events-none">
          📍 ${pinLabel}
        </div>
        <div class="relative w-7 h-7 rounded-full border-2 border-white bg-brand-600 text-white shadow-lg flex items-center justify-center font-black text-xs ring-2 ring-brand-500/30">
          📍
        </div>
        <div class="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[9px] px-2 py-0.5 rounded shadow-md pointer-events-none whitespace-nowrap font-mono font-bold border border-slate-700">
          ${pinLat.toFixed(5)}, ${pinLng.toFixed(5)}
        </div>
      </div>
    `;

    const dropIcon = L.divIcon({
      className: 'custom-drop-pin-icon',
      html: dropIconHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([pinLat, pinLng], {
      icon: dropIcon,
      draggable: true,
      zIndexOffset: 1500
    }).addTo(map);

    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      if (pos && onDropPinChangeRef.current) {
        onDropPinChangeRef.current(Number(pos.lat.toFixed(5)), Number(pos.lng.toFixed(5)));
      }
    });

    dropPinMarkerRef.current = marker;
  }, [dropPinLocation]);

  // Render Secondary/Other Routes in Distinct Colors (Purple, Teal, Orange, Pink)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    otherRouteLayersRef.current.forEach((l) => l.remove());
    otherRouteLayersRef.current = [];

    if (secondaryRoutes.length === 0) return;

    let isCancelled = false;

    secondaryRoutes.forEach((routeItem, rIdx) => {
      const palette = OTHER_ROUTE_COLORS[rIdx % OTHER_ROUTE_COLORS.length];
      const rStops = routeItem.stops;

      const drawOtherRoute = (latlngs) => {
        if (isCancelled || !mapInstanceRef.current) return;
        const casing = L.polyline(latlngs, {
          color: palette.casing,
          weight: 8,
          opacity: 0.75,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        const line = L.polyline(latlngs, {
          color: palette.main,
          weight: 4.5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-size:12px;font-weight:700;color:${palette.main};">🛣 ${routeItem.name}</div>`
          );

        otherRouteLayersRef.current.push(casing, line);

        // Also render stop pins for this route in its distinct color
        rStops.forEach((st, sIdx) => {
          const isStart = sIdx === 0;
          const isEnd = sIdx === rStops.length - 1;
          const stopDot = L.circleMarker([Number(st.latitude), Number(st.longitude)], {
            radius: isStart || isEnd ? 7 : 5,
            fillColor: palette.main,
            color: '#FFFFFF',
            weight: 2,
            fillOpacity: 1
          })
            .addTo(map)
            .bindPopup(
              `<div style="font-size:12px;color:#0F172A;">
                <strong style="color:${palette.main};">${routeItem.name}</strong><br/>
                <b>Stop #${sIdx + 1}: ${st.name}</b>
              </div>`
            );
          otherRouteLayersRef.current.push(stopDot);
        });
      };

      if (roadPathCache.has(routeItem.sig)) {
        drawOtherRoute(roadPathCache.get(routeItem.sig).latlngs);
      } else {
        const coordQuery = rStops
          .map((s) => `${Number(s.longitude).toFixed(5)},${Number(s.latitude).toFixed(5)}`)
          .join(';');
        fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordQuery}?overview=full&geometries=geojson&steps=false&alternatives=true`
        )
          .then((res) => res.json())
          .then((data) => {
            if (isCancelled || !mapInstanceRef.current) return;
            if (data && data.code === 'Ok' && data.routes && data.routes[0]) {
              const bestRoute = data.routes.reduce(
                (shortest, candidate) =>
                  Number(candidate.distance || Infinity) < Number(shortest.distance || Infinity)
                    ? candidate
                    : shortest,
                data.routes[0]
              );
              const rawLatLngs = bestRoute.geometry.coordinates.map(([lng, lat]) => [
                Number(lat),
                Number(lng)
              ]);
              const clamped = clampRoadPathToDestination(
                rawLatLngs,
                rStops[0],
                rStops[rStops.length - 1]
              );
              const exactKm = Math.max(0.5, Number((bestRoute.distance / 1000).toFixed(2)));
              const exactMins = Math.max(2, Math.round((exactKm / 26) * 60));
              roadPathCache.set(routeItem.sig, {
                latlngs: clamped,
                distanceKm: exactKm,
                durationMins: exactMins
              });
              drawOtherRoute(clamped);
            } else {
              drawOtherRoute(rStops.map((s) => [Number(s.latitude), Number(s.longitude)]));
            }
          })
          .catch(() => {
            drawOtherRoute(rStops.map((s) => [Number(s.latitude), Number(s.longitude)]));
          });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [secondaryRoutesSig]);

  // Render Exact Real-World Shortest Connected Road Route Path (in Blue #2563EB) & Stop Markers IN EXACT ORDER
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const sigWithEdit = `${stopsSignature}|edit:${Boolean(editableStops)}`;
    if (lastStopsSigRef.current === sigWithEdit && stopMarkersRef.current.length > 0) {
      return;
    }
    lastStopsSigRef.current = sigWithEdit;

    const map = mapInstanceRef.current;

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];
    routeLayersRef.current.forEach((l) => l.remove());
    routeLayersRef.current = [];
    currentRoadLatLngsRef.current = [];

    const validStops = (activeStops || []).filter((s) => s && s.latitude && s.longitude);
    if (validStops.length === 0) {
      setRoadRouteMeta({ distanceKm: null, durationMins: null });
      return;
    }

    // Place Distinct START, Numbered Intermediate, and DESTINATION Pins in strict array order
    validStops.forEach((stop, index) => {
      const isStart = index === 0;
      const isEnd = index === validStops.length - 1 && validStops.length > 1;

      const pinBg = isStart
        ? 'bg-emerald-600 text-white border-white ring-4 ring-emerald-500/30'
        : isEnd
        ? 'bg-rose-600 text-white border-white ring-4 ring-rose-500/30'
        : 'bg-blue-600 text-white border-white ring-2 ring-blue-500/30';

      const roleTag = isStart
        ? `<div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-black uppercase tracking-wider shadow whitespace-nowrap pointer-events-none">START #1</div>`
        : isEnd
        ? `<div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[8px] font-black uppercase tracking-wider shadow whitespace-nowrap pointer-events-none">🏁 DEST #${index + 1}</div>`
        : '';

      const hasCustomLandmark =
        stop.landmark &&
        stop.landmark !== 'Starting Point' &&
        stop.landmark !== 'Destination Terminal' &&
        stop.landmark !== 'Transit Stop' &&
        !String(stop.name).toLowerCase().includes(String(stop.landmark).toLowerCase());

      // Pin circle is 28x28 anchored at [14, 14] so the pin center sits on the EXACT GPS coordinate
      const stopIconHtml = `
        <div class="relative w-7 h-7 flex items-center justify-center">
          ${roleTag}
          <div class="w-7 h-7 rounded-full border-2 ${pinBg} shadow-lg flex items-center justify-center font-extrabold text-xs">
            ${isEnd ? '🏁' : index + 1}
          </div>
          <div class="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] px-2 py-0.5 rounded-md shadow-md pointer-events-none whitespace-nowrap font-bold border border-slate-700 text-center">
            <span>${index + 1}. ${stop.name}</span>
            ${
              hasCustomLandmark
                ? `<span class="block text-[8px] text-amber-300 font-semibold">${stop.landmark}</span>`
                : ''
            }
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-stop-div-icon',
        html: stopIconHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

      // Already-set stops and route endpoints are LOCKED in place (draggable: false) and can only be removed via Delete button
      const stopMarker = L.marker([Number(stop.latitude), Number(stop.longitude)], {
        icon,
        draggable: false
      })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.45; color: #0F172A; min-width: 195px;">
            <strong style="display:block; font-size:13px; color:${isStart ? '#059669' : isEnd ? '#E11D48' : '#2563EB'};">
              ${isStart ? '🟢 Start Stop (#1)' : isEnd ? `🏁 Final Destination (#${index + 1})` : `🔵 Stop #${index + 1}`}: ${stop.name}
            </strong>
            ${
              hasCustomLandmark
                ? `<span style="color: #475569; font-size:11px; display:block; margin-top:2px;">📍 Landmark: <b>${stop.landmark}</b></span>`
                : ''
            }
            <span style="color: #64748B; font-size:10px; font-family:monospace; display:block; margin-top:2px;">GPS: ${Number(stop.latitude).toFixed(5)}, ${Number(stop.longitude).toFixed(5)}</span>
          </div>
        `);

      stopMarkersRef.current.push(stopMarker);
    });

    // Fit map to exact route stops when route changes
    const stopBoundsPts = validStops.map((s) => [Number(s.latitude), Number(s.longitude)]);
    if (stopBoundsPts.length > 1) {
      map.fitBounds(L.latLngBounds(stopBoundsPts), { padding: [65, 65], maxZoom: 16, animate: true });
    } else if (stopBoundsPts.length === 1) {
      map.flyTo(stopBoundsPts[0], 15, { duration: 0.6 });
    }

    if (validStops.length < 2) {
      setRoadRouteMeta({ distanceKm: null, durationMins: null });
      return;
    }

    const applyRoadGeometry = (latlngs, distanceKm, durationMins, legDistancesKm = [], notifyParent = true) => {
      if (!mapInstanceRef.current) return;
      currentRoadLatLngsRef.current = latlngs;
      renderRoadAndTrafficLayers(latlngs, showTrafficLayer, validStops);
      setRoadRouteMeta({ distanceKm, durationMins, legDistancesKm });
      if (notifyParent && onRouteCalculatedRef.current && distanceKm) {
        onRouteCalculatedRef.current({
          distanceKm,
          durationMins,
          legDistancesKm,
          stopsCount: validStops.length
        });
      }
    };

    let fallbackSumKm = 0;
    const fallbackLegDistances = [];
    for (let i = 0; i < validStops.length - 1; i++) {
      const legDirect = calcHaversineKm(
        Number(validStops[i].latitude),
        Number(validStops[i].longitude),
        Number(validStops[i + 1].latitude),
        Number(validStops[i + 1].longitude)
      );
      fallbackSumKm += legDirect;
      fallbackLegDistances.push(Math.max(0.2, Number((legDirect * 1.24).toFixed(2))));
    }
    const fallbackRoadKm = Math.max(0.8, Number((fallbackSumKm * 1.24).toFixed(2)));
    const fallbackMins = Math.max(2, Math.round((fallbackRoadKm / 30) * 60));

    if (roadPathCache.has(stopsSignature)) {
      const cached = roadPathCache.get(stopsSignature);
      applyRoadGeometry(
        cached.latlngs,
        cached.distanceKm,
        cached.durationMins,
        cached.legDistancesKm || fallbackLegDistances,
        true
      );
      return;
    }

    // Draw initial straight-line connection while OSRM road route loads, without overwriting parent DB distance
    const straightLatLngs = validStops.map((s) => [Number(s.latitude), Number(s.longitude)]);
    applyRoadGeometry(straightLatLngs, fallbackRoadKm, fallbackMins, fallbackLegDistances, false);

    let isCancelled = false;

    // Fetch exact connected SHORTEST road geometry leg-by-leg in parallel across all stops in exact sequence:
    // Start (#1) -> Stop #2 -> Stop #3 -> ... -> Final Destination (#N)
    const fetchMultiStopRoadRoute = async () => {
      try {
        const legPromises = [];
        for (let i = 0; i < validStops.length - 1; i++) {
          const fromStop = validStops[i];
          const toStop = validStops[i + 1];
          const fromLat = Number(fromStop.latitude);
          const fromLng = Number(fromStop.longitude);
          const toLat = Number(toStop.latitude);
          const toLng = Number(toStop.longitude);
          const legKey = `LEG_SHORTEST:${fromLat.toFixed(5)},${fromLng.toFixed(5)}->${toLat.toFixed(5)},${toLng.toFixed(5)}`;
          const legDirectKm = calcHaversineKm(fromLat, fromLng, toLat, toLng);

          if (roadPathCache.has(legKey)) {
            legPromises.push(Promise.resolve(roadPathCache.get(legKey)));
          } else {
            const legQuery = `${fromLng.toFixed(5)},${fromLat.toFixed(5)};${toLng.toFixed(5)},${toLat.toFixed(5)}`;
            legPromises.push(
              fetch(
                `https://router.project-osrm.org/route/v1/driving/${legQuery}?overview=full&geometries=geojson&steps=false&alternatives=true`
              )
                .then((res) => res.json())
                .then((data) => {
                  if (data && data.code === 'Ok' && data.routes && data.routes[0]) {
                    // Pick the shortest-distance road path connecting this stop to the next stop
                    const rObj = data.routes.reduce(
                      (shortest, candidate) =>
                        Number(candidate.distance || Infinity) < Number(shortest.distance || Infinity)
                          ? candidate
                          : shortest,
                      data.routes[0]
                    );
                    const rawCoords = rObj.geometry.coordinates.map(([lng, lat]) => [
                      Number(lat),
                      Number(lng)
                    ]);
                    const legLatLngs = clampRoadPathToDestination(rawCoords, fromStop, toStop);
                    const legKm = Math.max(
                      Number(legDirectKm.toFixed(2)),
                      Number((rObj.distance / 1000).toFixed(2))
                    );
                    const legDurationSec = Math.round((legKm / 30) * 3600);
                    const result = { legLatLngs, legKm, legDurationSec };
                    roadPathCache.set(legKey, result);
                    return result;
                  }
                  throw new Error('OSRM leg fallback');
                })
                .catch(() => {
                  const fallbackKm = Math.max(0.2, Number((legDirectKm * 1.24).toFixed(2)));
                  const fallbackLeg = {
                    legLatLngs: [
                      [fromLat, fromLng],
                      [toLat, toLng]
                    ],
                    legKm: fallbackKm,
                    legDurationSec: Math.round((fallbackKm / 30) * 3600)
                  };
                  return fallbackLeg;
                })
            );
          }
        }

        const resolvedLegs = await Promise.all(legPromises);
        if (isCancelled || !mapInstanceRef.current) return;

        const combinedLatLngs = [];
        const legDistancesKm = [];
        let totalExactKm = 0;

        resolvedLegs.forEach((legRes, idx) => {
          const pts = legRes.legLatLngs || [];
          const km = Number((legRes.legKm || 0).toFixed(2));
          legDistancesKm.push(km);
          totalExactKm += km;
          if (idx === 0) {
            combinedLatLngs.push(...pts);
          } else {
            combinedLatLngs.push(...pts.slice(1));
          }
        });

        if (combinedLatLngs.length >= 2) {
          const exactKm = Math.max(
            Number(fallbackSumKm.toFixed(2)),
            Number(totalExactKm.toFixed(2))
          );
          // Exact ETA based on 30 km/h shuttle cruising speed: ETA (mins) = round((distance_km / 30) * 60)
          const exactMins = Math.max(2, Math.round((exactKm / 30) * 60));
          roadPathCache.set(stopsSignature, {
            latlngs: combinedLatLngs,
            distanceKm: exactKm,
            durationMins: exactMins,
            legDistancesKm
          });
          applyRoadGeometry(combinedLatLngs, exactKm, exactMins, legDistancesKm, true);
        }
      } catch (err) {
        console.warn('Multi-stop route calculation fallback:', err);
      }
    };

    fetchMultiStopRoadRoute();

    return () => {
      isCancelled = true;
    };
  }, [stopsSignature]);

  // Update Shuttle Markers immediately on every GPS / socket tick with zero delay
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const currentMarkerMap = markersRef.current;
    const currentStateMap = markerStateRef.current;

    const activeIds = new Set(shuttles.map((s) => s.id));
    for (const [id, m] of currentMarkerMap.entries()) {
      if (!activeIds.has(id)) {
        m.remove();
        currentMarkerMap.delete(id);
        currentStateMap.delete(id);
      }
    }

    const snapToRoadPolyline = (rawLat, rawLng) => {
      const poly = currentRoadLatLngsRef.current;
      if (!Array.isArray(poly) || poly.length < 2) {
        return [rawLat, rawLng];
      }
      let bestLat = rawLat;
      let bestLng = rawLng;
      let minDistKm = Infinity;
      for (let i = 0; i < poly.length - 1; i++) {
        const aLat = Number(poly[i][0]);
        const aLng = Number(poly[i][1]);
        const bLat = Number(poly[i + 1][0]);
        const bLng = Number(poly[i + 1][1]);
        const dx = bLng - aLng;
        const dy = bLat - aLat;
        const lenSq = dx * dx + dy * dy;
        const t =
          lenSq === 0
            ? 0
            : Math.max(0, Math.min(1, ((rawLng - aLng) * dx + (rawLat - aLat) * dy) / lenSq));
        const pLat = aLat + t * dy;
        const pLng = aLng + t * dx;
        const dKm = calcHaversineKm(rawLat, rawLng, pLat, pLng);
        if (dKm < minDistKm) {
          minDistKm = dKm;
          bestLat = pLat;
          bestLng = pLng;
        }
      }
      return minDistKm <= 0.42 ? [bestLat, bestLng] : [rawLat, rawLng];
    };

    shuttles.forEach((shuttle) => {
      const rawLat = Number(shuttle.current_lat) || center[0];
      const rawLng = Number(shuttle.current_lng) || center[1];
      const [lat, lng] = snapToRoadPolyline(rawLat, rawLng);
      const isSelected = Boolean(selectedShuttleId && Number(shuttle.id) === Number(selectedShuttleId));
      const isArrived =
        String(shuttle.next_stop_name || '').includes('Arrived') ||
        String(shuttle.next_stop_name || '').includes('Destination Reached');
      const speedVal = isArrived
        ? 0
        : Math.max(0, Math.round(Number(shuttle.speed || 0)));
      const exactTotalKm = Number(
        shuttle.distance_km !== undefined && Number(shuttle.distance_km) > 0
          ? shuttle.distance_km
          : roadRouteMeta.distanceKm || 4.5
      );
      const distVal = isArrived ? '0.00' : exactTotalKm.toFixed(2);
      const etaVal = isArrived
        ? 0
        : shuttle.eta_minutes !== undefined && Number(shuttle.eta_minutes) > 0
        ? Math.max(1, Math.round(Number(shuttle.eta_minutes)))
        : Math.max(1, Math.round((exactTotalKm / Math.max(speedVal, 25)) * 60));

      const statusColor =
        shuttle.status === 'delayed'
          ? '#F59E0B'
          : shuttle.status === 'inactive'
          ? '#64748B'
          : isArrived
          ? '#10B981'
          : '#2563EB';

      const badgeText = isArrived ? `🏁 Arrived` : `${speedVal} km/h • ${distVal} km • ${etaVal}m`;

      const popupContent = `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.5; color: #0F172A; min-width: 220px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
            <strong style="font-size:14px; color:#1E3A8A;">🚍 ${shuttle.code} — ${shuttle.name || shuttle.vehicle_number || 'Shuttle'}</strong>
          </div>
          <div style="font-size:11px; color:#475569;">
            <div><strong>Route:</strong> ${shuttle.start_point || 'Start'} ➔ ${shuttle.destination || 'Destination'}</div>
            <div><strong>Driver:</strong> ${shuttle.driver_name || 'Assigned Operator'}</div>
            <div><strong>Next Stop:</strong> <span style="color:#2563EB; font-weight:700;">${shuttle.next_stop_name || activeStops[1]?.name || 'En Route'}</span></div>
            <div style="margin-top:4px; padding-top:4px; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; font-weight:700; color:#0F172A;">
              <span>⚡ ${speedVal} km/h</span>
              <span style="color:#059669;">${isArrived ? '🏁 At Destination' : `⏱ ETA: ${etaVal} min (${distVal} km)`}</span>
            </div>
          </div>
        </div>
      `;

      const createMarkerHtml = () => `
        <div class="relative flex flex-col items-center" style="transform: scale(${isSelected ? 1.12 : 1});">
          <div class="relative flex items-center justify-center w-11 h-11 rounded-2xl shadow-elevated text-white font-extrabold text-xs border-2 ${
            isSelected ? 'border-amber-300 ring-4 ring-blue-500/30' : 'border-white dark:border-slate-900'
          }" style="background-color: ${statusColor};">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 6v6m7-6v6m-13 0h19.6m-3.6 6h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 00-2 2v10h3m2 0h5m5 0a2 2 0 11-4 0 2 2 0 014 0zm-11 0a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <div class="absolute -top-2 -right-2 bg-slate-900 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold border border-slate-700">
              ${shuttle.code}
            </div>
          </div>
          <div data-telemetry-badge="${shuttle.id}" class="mt-0.5 px-2 py-0.5 rounded-full bg-slate-900/95 text-white text-[10px] font-bold whitespace-nowrap shadow-md border border-slate-700">
            ${badgeText}
          </div>
        </div>
      `;

      if (currentMarkerMap.has(shuttle.id)) {
        const marker = currentMarkerMap.get(shuttle.id);
        marker.setLatLng([lat, lng]);
        marker.setPopupContent(popupContent);

        const prevState = currentStateMap.get(shuttle.id);
        if (
          !prevState ||
          prevState.isSelected !== isSelected ||
          prevState.status !== shuttle.status ||
          prevState.isArrived !== isArrived
        ) {
          const customIcon = L.divIcon({
            className: 'custom-shuttle-marker',
            html: createMarkerHtml(),
            iconSize: [90, 64],
            iconAnchor: [45, 26]
          });
          marker.setIcon(customIcon);
          currentStateMap.set(shuttle.id, { isSelected, status: shuttle.status, isArrived });
        } else {
          const el = marker.getElement();
          if (el) {
            const badgeEl = el.querySelector(`[data-telemetry-badge="${shuttle.id}"]`);
            if (badgeEl) {
              badgeEl.textContent = badgeText;
            }
          }
        }
      } else {
        const customIcon = L.divIcon({
          className: 'custom-shuttle-marker',
          html: createMarkerHtml(),
          iconSize: [90, 64],
          iconAnchor: [45, 26]
        });
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map).bindPopup(popupContent);
        marker.on('click', () => {
          if (onSelectShuttle) onSelectShuttle(shuttle);
          map.flyTo([lat, lng], 16, { animate: true, duration: 0.5 });
          marker.openPopup();
        });
        currentMarkerMap.set(shuttle.id, marker);
        currentStateMap.set(shuttle.id, { isSelected, status: shuttle.status, isArrived });
      }
    });

    if (followSelectedBus && !isUserInteractingRef.current) {
      const target =
        shuttles.find((s) => Number(s.id) === Number(selectedShuttleId)) || shuttles[0];
      if (target && target.current_lat && target.current_lng) {
        map.panTo([Number(target.current_lat), Number(target.current_lng)], { animate: true });
      }
    }

    if (showAllFitOnLoad && !hasInitialFittedRef.current && (shuttles.length > 0 || activeStops.length > 0)) {
      hasInitialFittedRef.current = true;
      setTimeout(() => handleFitAllFleet(), 250);
    }
  }, [shuttles, selectedShuttleId, followSelectedBus, showAllFitOnLoad, roadRouteMeta.distanceKm]);

  // Fly to bus ONLY when user explicitly triggers focusTrigger > 0 (or when no route stops exist)
  // This ensures initial load in Passenger & Admin views fits the full connected route path!
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedShuttleId || isUserInteractingRef.current) return;
    if (focusTrigger === 0 && activeStops && activeStops.length >= 2) return;
    const map = mapInstanceRef.current;
    const selected = shuttlesRef.current.find((s) => Number(s.id) === Number(selectedShuttleId));
    if (selected && selected.current_lat && selected.current_lng) {
      const lat = Number(selected.current_lat);
      const lng = Number(selected.current_lng);
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.5
      });
      const marker = markersRef.current.get(selected.id);
      if (marker) {
        marker.openPopup();
      }
    }
  }, [selectedShuttleId, focusTrigger]);

  // Active shuttle telemetry & trip completion progress calculation
  const hudShuttle =
    shuttles.find((s) => Number(s.id) === Number(selectedShuttleId)) || shuttles[0] || null;
  const isHudArrived =
    hudShuttle &&
    (String(hudShuttle.next_stop_name || '').includes('Arrived') ||
      String(hudShuttle.next_stop_name || '').includes('Destination Reached'));
  const hudSpeed = hudShuttle
    ? isHudArrived
      ? 0
      : Math.max(0, Math.round(Number(hudShuttle.speed || 0)))
    : 0;
  const hudTotalRoadKm = Number(
    roadRouteMeta.distanceKm || hudShuttle?.distance_km || hudShuttle?.total_route_km || 4.5
  ).toFixed(2);
  const hudTotalMins = Math.max(1, Math.round((Number(hudTotalRoadKm) / Math.max(hudSpeed, 25)) * 60));
  const hudNextDist = hudShuttle
    ? isHudArrived
      ? '0.00'
      : Number(
          hudShuttle.distance_km !== undefined && Number(hudShuttle.distance_km) > 0
            ? hudShuttle.distance_km
            : roadRouteMeta.legDistancesKm?.[0] || hudTotalRoadKm
        ).toFixed(2)
    : '0.00';
  const hudEta = hudShuttle
    ? isHudArrived
      ? 0
      : hudShuttle.eta_minutes !== undefined && Number(hudShuttle.eta_minutes) > 0
      ? Math.max(1, Math.round(Number(hudShuttle.eta_minutes)))
      : Math.max(1, Math.round((Number(hudNextDist) / Math.max(hudSpeed, 25)) * 60))
    : 0;

  const tripProgressPct = useMemo(() => {
    if (isHudArrived) return 100;
    const valid = (activeStops || []).filter((s) => s && s.latitude && s.longitude);
    if (!hudShuttle || valid.length < 2 || !hudShuttle.current_lat || !hudShuttle.current_lng) {
      return 45;
    }
    const startSt = valid[0];
    const endSt = valid[valid.length - 1];
    const dStart = calcHaversineKm(
      Number(startSt.latitude),
      Number(startSt.longitude),
      Number(hudShuttle.current_lat),
      Number(hudShuttle.current_lng)
    );
    const dEnd = calcHaversineKm(
      Number(hudShuttle.current_lat),
      Number(hudShuttle.current_lng),
      Number(endSt.latitude),
      Number(endSt.longitude)
    );
    const total = Math.max(0.1, dStart + dEnd);
    return Math.min(98, Math.max(8, Math.round((dStart / total) * 100)));
  }, [hudShuttle, activeStops, isHudArrived]);

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-3 z-[9999] rounded-3xl shadow-2xl'
          : `relative w-full rounded-2xl shadow-subtle ${className}`
      } overflow-hidden border border-slate-200/90 dark:border-slate-800 select-none bg-white dark:bg-slate-900 flex flex-col isolate`}
      style={
        isFullscreen
          ? { height: 'calc(100vh - 24px)', width: 'calc(100vw - 24px)', isolation: 'isolate' }
          : { height: '100%', width: '100%', isolation: 'isolate' }
      }
    >
      {/* Dedicated Top Control Bar — Never overlaps or merges with map pins or zoom buttons */}
      <div className="px-3.5 py-2.5 bg-slate-900 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-20">
        {/* Left: Map Status & Route / Traffic Color Legend */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="font-extrabold text-xs text-white whitespace-nowrap">
              {mapProvider === 'satellite' ? 'Google Satellite Live' : 'Google Maps Live'}
            </span>
          </div>

          {/* Color Legend: Clearly explains Route & Traffic Mode colors */}
          <div className="flex flex-wrap items-center gap-2.5 border-l border-slate-700 pl-3 text-[11px] font-bold">
            {showTrafficLayer ? (
              <>
                <span className="inline-flex items-center gap-1 text-blue-400 whitespace-nowrap">
                  <span className="w-3 h-2 rounded-full bg-blue-600 border border-white/40" />
                  Blue: No Traffic
                </span>
                <span className="inline-flex items-center gap-1 text-yellow-300 whitespace-nowrap">
                  <span className="w-3 h-2 rounded-full bg-yellow-400 border border-white/40" />
                  Yellow: Moderate
                </span>
                <span className="inline-flex items-center gap-1 text-rose-400 whitespace-nowrap">
                  <span className="w-3 h-2 rounded-full bg-red-500 border border-white/40" />
                  Red: Heavy Traffic
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 text-blue-400 whitespace-nowrap">
                  <span className="w-3 h-2 rounded-full bg-blue-600 border border-white/40" />
                  Blue: Active Route Path
                </span>
                {secondaryRoutes.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-purple-300 whitespace-nowrap">
                    <span className="w-3 h-2 rounded-full bg-purple-500 border border-white/40" />
                    Other Routes ({secondaryRoutes.length})
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Traffic Mode Toggle + Google Maps / Satellite Switcher + Navigation Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowTrafficLayer((t) => !t)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1.5 border ${
              showTrafficLayer
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Traffic Mode (Blue = No Traffic, Yellow = Moderate, Red = Heavy)"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Traffic Mode: {showTrafficLayer ? 'ON' : 'OFF'}</span>
          </button>

          {/* Map Provider Switcher: ONLY Google Maps & Satellite (Radar Removed) */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => handleProviderChange('google')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                mapProvider === 'google'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <MapIcon className="w-3 h-3" />
              <span>Google Maps</span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('satellite')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                mapProvider === 'satellite'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Satellite</span>
            </button>
          </div>

          {(selectedShuttleId || shuttles.length > 0) && (
            <button
              type="button"
              onClick={() => {
                const nextFollow = !followSelectedBus;
                setFollowSelectedBus(nextFollow);
                if (nextFollow) handleCenterSelected();
              }}
              title="Auto-Follow Moving Bus"
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-all ${
                followSelectedBus
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Navigation className="w-3 h-3" />
              <span>{followSelectedBus ? 'Following' : 'Follow Bus'}</span>
            </button>
          )}

          {shuttles.length > 0 && (
            <button
              type="button"
              onClick={handleCenterSelected}
              title="Locate Bus on Map"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold text-blue-300 hover:bg-slate-700 flex items-center gap-1 transition-all"
            >
              <LocateFixed className="w-3 h-3" />
              <span>Locate Bus</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleFitAllFleet}
            title="Fit Full Route & Stops"
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200 hover:bg-slate-700 flex items-center gap-1 transition-all"
          >
            <RouteIcon className="w-3 h-3" />
            <span>Fit Route</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? 'Exit Fullscreen Map' : 'Expand Fullscreen Map'}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Middle Interactive Map Canvas — Strictly Contained */}
      <div className="relative flex-1 w-full min-h-[220px] min-h-0 overflow-hidden z-0">
        <div
          ref={mapContainerRef}
          className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
          style={{ height: '100%', width: '100%' }}
        />
      </div>

      {/* Dedicated Bottom Telemetry Footer Bar — Zero Overlap With Map Canvas */}
      {hudShuttle ? (
        <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2.5 py-1 rounded-lg bg-brand-600 text-white font-mono font-black text-xs shrink-0">
              {hudShuttle.code}
            </span>
            <div className="min-w-0">
              <div className="font-extrabold text-navy-900 dark:text-white truncate">
                {hudShuttle.start_point || activeStops[0]?.name || 'Start'} ➔{' '}
                {hudShuttle.destination || activeStops[activeStops.length - 1]?.name || 'Destination'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Next Stop:{' '}
                <span className="font-bold text-brand-600 dark:text-blue-400">
                  {hudShuttle.next_stop_name || activeStops[1]?.name || 'En Route'}
                </span>{' '}
                • GPS: {Number(hudShuttle.current_lat || center[0]).toFixed(4)},{' '}
                {Number(hudShuttle.current_lng || center[1]).toFixed(4)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-brand-500 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Speed</span>
                <span className="font-black text-navy-900 dark:text-white">{hudSpeed} km/h</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
              <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Next ETA</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {isHudArrived ? 'Arrived' : `${hudEta} min (${hudNextDist} km)`}
                </span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
              <RouteIcon className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Route</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {hudTotalRoadKm} km • ~{hudTotalMins} min ({tripProgressPct}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : activeStops.length >= 2 ? (
        <div className="px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px] uppercase">
              Start: {activeStops[0]?.name}
            </span>
            <span className="text-slate-400 font-bold">➔</span>
            {activeStops.length > 2 && (
              <>
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px]">
                  +{activeStops.length - 2} Intermediate Stop{activeStops.length - 2 > 1 ? 's' : ''}
                </span>
                <span className="text-slate-400 font-bold">➔</span>
              </>
            )}
            <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px] uppercase">
              Dest: {activeStops[activeStops.length - 1]?.name}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-extrabold text-navy-900 dark:text-white">
            <span>
              Exact Map Distance:{' '}
              <span className="text-brand-600 dark:text-blue-400">
                {roadRouteMeta.distanceKm || hudTotalRoadKm} km
              </span>
            </span>
            <span>
              Est. Time:{' '}
              <span className="text-emerald-600 dark:text-emerald-400">
                ~{roadRouteMeta.durationMins || hudTotalMins} min
              </span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const LiveMap = (props) => {
  return (
    <MapErrorBoundary>
      <LiveMapInner {...props} />
    </MapErrorBoundary>
  );
};

export default LiveMap;
