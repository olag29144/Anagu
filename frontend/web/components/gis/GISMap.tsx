'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Trash2, Save } from 'lucide-react';

// Dynamic imports to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then(m => m.Polygon), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
const useMap = dynamic(() => import('react-leaflet').then(m => m.useMap), { ssr: false });

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

function DrawingControls({ onClear, onSave, hasPoints }: { onClear: () => void; onSave: () => void; hasPoints: boolean }) {
  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 space-y-2">
      <button
        onClick={onSave}
        disabled={!hasPoints}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        <Save size={18} />
        Save Boundary
      </button>
      <button
        onClick={onClear}
        disabled={!hasPoints}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        <Trash2 size={18} />
        Clear
      </button>
    </div>
  );
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  
  useEffect(() => {
    const handleClick = (e: any) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);
  
  return null;
}

export default function GISMap({ 
  center = [8.9328677, 11.336599], 
  zoom = 15,
  onBoundaryDraw,
  existingBoundary = []
}: GISMapProps) {
  const [points, setPoints] = useState<LatLngPoint[]>(existingBoundary);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMapClick = (lat: number, lng: number) => {
    const newPoints = [...points, { lat, lng }];
    setPoints(newPoints);
  };

  const handleClear = () => {
    setPoints([]);
  };

  const handleSave = () => {
    if (points.length >= 3 && onBoundaryDraw) {
      onBoundaryDraw(points);
    }
  };

  if (!mounted) {
    return (
      <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="mx-auto mb-2" size={48} />
          <p>Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border-2 border-gray-300">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <ClickHandler onMapClick={handleMapClick} />
        
        {/* Draw markers for each point */}
        {points.map((point, idx) => (
          <Marker key={idx} position={[point.lat, point.lng]}>
            <Popup>Point {idx + 1}</Popup>
          </Marker>
        ))}
        
        {/* Draw polygon if we have at least 3 points */}
        {points.length >= 3 && (
          <Polygon
            positions={points.map(p => [p.lat, p.lng])}
            pathOptions={{ 
              color: 'blue', 
              fillColor: 'lightblue', 
              fillOpacity: 0.4,
              weight: 3 
            }}
          />
        )}
      </MapContainer>
      
      <DrawingControls 
        onClear={handleClear} 
        onSave={handleSave} 
        hasPoints={points.length > 0}
      />
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3 max-w-xs">
        <h3 className="font-bold mb-1 flex items-center gap-2">
          <MapPin size={16} />
          Draw Land Boundary
        </h3>
        <p className="text-sm text-gray-600">
          Click on the map to add points. Need at least 3 points to create a boundary.
          Points: {points.length}
        </p>
      </div>
    </div>
  );
}
