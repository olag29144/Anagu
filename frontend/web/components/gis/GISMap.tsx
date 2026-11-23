'use client';

import { useEffect, useRef, useState } from 'react';

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface GISMapProps {
  center?: [number, number];
  zoom?: number;
  onBoundaryDraw?: (points: LatLngPoint[]) => void;
  existingBoundary?: LatLngPoint[];
}

export default function GISMap({ 
  center = [8.9328677, 11.336599], 
  zoom = 15,
  onBoundaryDraw,
  existingBoundary = []
}: GISMapProps) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonRef = useRef<any>(null);
  const [points, setPoints] = useState<LatLngPoint[]>(existingBoundary);
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    
    // Only run on client side
    if (typeof window === 'undefined') return;

    let map: any = null;
    let L: any = null;

    // Load Leaflet dynamically
    const initMap = async () => {
      try {
        setIsLoading(true);
        
        // Import Leaflet
        const leaflet = await import('leaflet');
        L = leaflet.default;
        
        // Fix icon paths for Leaflet
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Wait for container to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!mapRef.current && document.getElementById('map-container')) {
          // Create map
          map = L.map('map-container').setView(center, zoom);
          
          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          mapRef.current = map;

          // Add click handler for drawing boundaries
          map.on('click', (e: any) => {
            if (!L) return;

            const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
            setPoints((prev) => {
              const newPoints = [...prev, newPoint];

              // Update polygon
              if (newPoints.length >= 3) {
                if (polygonRef.current) {
                  map.removeLayer(polygonRef.current);
                }
                polygonRef.current = L.polygon(
                  newPoints.map((p) => [p.lat, p.lng]),
                  { color: '#38BDF8', fillColor: '#38BDF8', fillOpacity: 0.2 },
                ).addTo(map);
              }

              return newPoints;
            });

            // Add marker
            const marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
            markersRef.current.push(marker);
          });

          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error initializing map:', error);
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
      polygonRef.current = null;
    };
  }, [center, zoom]);

  const handleSave = () => {
    if (points.length >= 3 && onBoundaryDraw) {
      onBoundaryDraw(points);
    }
  };

  const handleClear = () => {
    setPoints([]);
    
    // Clear all markers
    markersRef.current.forEach(marker => {
      if (mapRef.current) {
        mapRef.current.removeLayer(marker);
      }
    });
    markersRef.current = [];
    
    // Clear polygon
    if (polygonRef.current && mapRef.current) {
      mapRef.current.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
  };

  if (!mounted || isLoading) {
    return (
      <div className="w-full h-[600px] bg-gray-900 rounded-lg flex items-center justify-center border-2 border-gray-700">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400">Loading OpenStreetMap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div id="map-container" className="w-full h-[600px] rounded-lg border-2 border-gray-700 z-0"></div>
      
      <div className="absolute top-4 right-4 z-[1000] bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-3 space-y-2">
        <button
          onClick={handleSave}
          disabled={points.length < 3}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save Boundary ({points.length} points)
        </button>
        <button
          onClick={handleClear}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Clear All
        </button>
      </div>
      
      <div className="mt-4 p-4 bg-blue-950 border border-blue-800 rounded-lg">
        <p className="text-sm text-blue-200">
          <strong>🗺️ OpenStreetMap Interactive Tool</strong> - Click on the map to add boundary points. You need at least 3 points to define a land parcel boundary.
        </p>
      </div>
    </div>
  );
}
