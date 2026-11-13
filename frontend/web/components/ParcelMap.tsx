'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });

interface ParcelMapProps {
  onBoundaryDrawn?: (wkt: string, coordinates: [number, number][]) => void;
  center?: [number, number];
  zoom?: number;
}

export default function ParcelMap({
  onBoundaryDrawn,
  center = [9.0765, 7.3986],
  zoom = 13,
}: ParcelMapProps) {
  const [mounted, setMounted] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const drawnLayersRef = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!map || typeof window === 'undefined' || !(window as any).L) return;

    const L = (window as any).L;
    
    // Wait for Leaflet Draw to load
    const checkDrawReady = setInterval(() => {
      if (L.Draw && L.Control.Draw) {
        clearInterval(checkDrawReady);
        initializeDrawing();
      }
    }, 100);

    const initializeDrawing = () => {
      drawnLayersRef.current = new L.FeatureGroup();
      map.addLayer(drawnLayersRef.current);

      const drawControl = new L.Control.Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            shapeOptions: {
              color: '#3b82f6',
              weight: 3,
              fillOpacity: 0.3,
            },
          },
          rectangle: {
            shapeOptions: {
              color: '#3b82f6',
              weight: 3,
              fillOpacity: 0.3,
            },
          },
          polyline: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: {
          featureGroup: drawnLayersRef.current,
          remove: true,
        },
      });

      map.addControl(drawControl);
      setDrawingEnabled(true);

      map.on(L.Draw.Event.CREATED, (event: any) => {
        const layer = event.layer;
        drawnLayersRef.current.clearLayers();
        drawnLayersRef.current.addLayer(layer);

        const latlngs = layer.getLatLngs()[0];
        const coords: [number, number][] = latlngs.map((ll: any) => [ll.lat, ll.lng]);
        
        // Convert to WKT (PostGIS format: lng, lat)
        const wktCoords = coords.map(([lat, lng]) => `${lng} ${lat}`).join(', ');
        const wkt = `SRID=4326;POLYGON((${wktCoords}, ${coords[0][1]} ${coords[0][0]}))`;
        
        if (onBoundaryDrawn) {
          onBoundaryDrawn(wkt, coords);
        }
      });
    };

    return () => {
      clearInterval(checkDrawReady);
    };
  }, [map, onBoundaryDrawn]);

  if (!mounted) {
    return (
      <div className="w-full h-[500px] bg-[#05080D] border border-[#1E293B] rounded-lg flex items-center justify-center">
        <p className="text-xs text-[#64748B]">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        whenCreated={setMap}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>

      <div className="absolute top-4 left-4 bg-[#0A0F16] border border-[#38BDF8]/30 p-3 rounded-lg shadow-lg z-[1000] max-w-sm">
        <p className="text-xs text-[#F4F7FB] font-semibold mb-1">
          {drawingEnabled ? '✓ Drawing Tools Active' : '⏳ Loading Drawing Tools...'}
        </p>
        <p className="text-[11px] text-[#94A3B8]">
          {drawingEnabled 
            ? 'Use toolbar on left to draw parcel boundaries' 
            : 'Map is loading...'}
        </p>
      </div>
    </div>
  );
}