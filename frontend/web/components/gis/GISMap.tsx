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
  const [points, setPoints] = useState<LatLngPoint[]>(existingBoundary);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Load Leaflet dynamically
    import('leaflet').then((L) => {
      if (!mapRef.current) {
        // Create map
        const map = L.map('map-container').setView(center, zoom);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        mapRef.current = map;

        // Add click handler
        map.on('click', (e: any) => {
          const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
          const newPoints = [...points, newPoint];
          setPoints(newPoints);
          
          // Add marker
          L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
        });
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const handleSave = () => {
    if (points.length >= 3 && onBoundaryDraw) {
      onBoundaryDraw(points);
    }
  };

  const handleClear = () => {
    setPoints([]);
    if (mapRef.current) {
      mapRef.current.eachLayer((layer: any) => {
        if (layer._latlng) { // It's a marker
          mapRef.current.removeLayer(layer);
        }
      });
    }
  };

  if (!mounted) {
    return (
      <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-600">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <link 
        rel="stylesheet" 
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <div id="map-container" className="w-full h-[600px] rounded-lg border-2 border-gray-300 z-0"></div>
      
      <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 space-y-2">
        <button
          onClick={handleSave}
          disabled={points.length < 3}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Save ({points.length} points)
        </button>
        <button
          onClick={handleClear}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Clear
        </button>
      </div>
      
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>🗺️ OpenStreetMap</strong> - Click on map to add boundary points. Need at least 3 points.
        </p>
      </div>
    </div>
  );
}
