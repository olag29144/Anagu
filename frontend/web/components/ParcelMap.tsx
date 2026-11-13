'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then((mod) => mod.Polygon), { ssr: false });

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!map) return;

    const handleMapClick = (e: any) => {
      if (!isDrawing) return;
      
      const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPoints(prev => [...prev, newPoint]);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, isDrawing]);

  const startDrawing = () => {
    setIsDrawing(true);
    setPoints([]);
  };

  const finishDrawing = () => {
    if (points.length < 3) {
      alert('Please click at least 3 points to create a parcel boundary');
      return;
    }

    setIsDrawing(false);

    // Close the polygon by adding first point at the end
    const closedPoints = [...points, points[0]];
    
    // Convert to WKT (PostGIS format: lng, lat)
    const wktCoords = closedPoints.map(([lat, lng]) => `${lng} ${lat}`).join(', ');
    const wkt = `SRID=4326;POLYGON((${wktCoords}))`;
    
    if (onBoundaryDrawn) {
      onBoundaryDrawn(wkt, points);
    }
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setPoints([]);
  };

  if (!mounted) {
    return (
      <div className="w-full h-[500px] bg-[#05080D] border border-[#1E293B] rounded-lg flex items-center justify-center">
        <p className="text-xs text-[#64748B]">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[400px] md:min-h-[500px]">
      {/* Map Container */}
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        whenCreated={setMap}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Show polygon as it's being drawn */}
        {points.length > 0 && (
          <Polygon
            positions={points}
            pathOptions={{
              color: '#3b82f6',
              weight: 3,
              fillOpacity: 0.3,
            }}
          />
        )}
      </MapContainer>

      {/* Mobile-Friendly Controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[1000] flex flex-col sm:flex-row gap-2 px-4 w-full sm:w-auto">
        {!isDrawing ? (
          <button
            onClick={startDrawing}
            className="bg-[#38BDF8] text-[#020305] px-6 py-3 rounded-lg font-semibold text-sm shadow-lg hover:bg-[#67E8F9] transition-all active:scale-95 w-full sm:w-auto"
          >
            🖊️ Start Drawing Parcel
          </button>
        ) : (
          <>
            <button
              onClick={finishDrawing}
              disabled={points.length < 3}
              className="bg-emerald-500 text-white px-6 py-3 rounded-lg font-semibold text-sm shadow-lg hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              ✓ Finish ({points.length} points)
            </button>
            <button
              onClick={cancelDrawing}
              className="bg-rose-500 text-white px-6 py-3 rounded-lg font-semibold text-sm shadow-lg hover:bg-rose-600 transition-all active:scale-95 w-full sm:w-auto"
            >
              ✗ Cancel
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-xs bg-[#0A0F16]/95 backdrop-blur-sm border border-[#38BDF8]/30 p-3 rounded-lg shadow-lg z-[1000]">
        <p className="text-xs text-[#F4F7FB] font-semibold mb-1">
          {isDrawing ? '🖊️ Drawing Mode Active' : '📍 Click "Start Drawing" to begin'}
        </p>
        <p className="text-[11px] text-[#94A3B8]">
          {isDrawing 
            ? `Tap on the map to add boundary points. Need ${Math.max(0, 3 - points.length)} more point(s) minimum.`
            : 'Draw your parcel boundary by clicking points on the map'}
        </p>
      </div>

      {/* Point Counter */}
      {isDrawing && points.length > 0 && (
        <div className="absolute top-20 right-4 bg-[#0A0F16]/95 backdrop-blur-sm border border-emerald-500/40 px-3 py-2 rounded-lg shadow-lg z-[1000]">
          <p className="text-xs text-emerald-400 font-mono">
            {points.length} {points.length === 1 ? 'point' : 'points'}
          </p>
        </div>
      )}
    </div>
  );
}