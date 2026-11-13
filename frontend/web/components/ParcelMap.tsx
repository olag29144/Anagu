'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const FeatureGroup = dynamic(
  () => import('react-leaflet').then((mod) => mod.FeatureGroup),
  { ssr: false }
);

interface ParcelMapProps {
  onBoundaryDrawn?: (wkt: string, coordinates: [number, number][]) => void;
  existingParcels?: Array<{ id: string; coordinates: [number, number][] }>;
  center?: [number, number];
  zoom?: number;
}

export default function ParcelMap({
  onBoundaryDrawn,
  existingParcels = [],
  center = [9.0765, 7.3986], // Abuja, Nigeria
  zoom = 13,
}: ParcelMapProps) {
  const [map, setMap] = useState<any>(null);
  const featureGroupRef = useRef<any>(null);
  const [drawnCoordinates, setDrawnCoordinates] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!map) return;

    // Import Leaflet Draw dynamically
    import('leaflet-draw').then((L) => {
      const drawControl = new (L as any).Control.Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            metric: true,
            shapeOptions: {
              color: '#3b82f6',
              weight: 2,
            },
          },
          polyline: false,
          rectangle: true,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: {
          featureGroup: featureGroupRef.current,
          remove: true,
        },
      });

      map.addControl(drawControl);

      map.on((L as any).Draw.Event.CREATED, (event: any) => {
        const layer = event.layer;
        const latlngs = layer.getLatLngs()[0];
        const coords: [number, number][] = latlngs.map((ll: any) => [ll.lat, ll.lng]);
        
        setDrawnCoordinates(coords);
        
        // Convert to WKT format for PostGIS
        const wkt = coordsToWKT(coords);
        
        if (onBoundaryDrawn) {
          onBoundaryDrawn(wkt, coords);
        }

        featureGroupRef.current?.clearLayers();
        featureGroupRef.current?.addLayer(layer);
      });
    });

    return () => {
      if (map) {
        map.off();
      }
    };
  }, [map, onBoundaryDrawn]);

  const coordsToWKT = (coords: [number, number][]): string => {
    // WKT uses longitude, latitude order (opposite of Leaflet)
    const wktCoords = coords.map(([lat, lng]) => `${lng} ${lat}`).join(', ');
    // Close the polygon by repeating the first point
    const firstPoint = coords[0];
    return `SRID=4326;POLYGON((${wktCoords}, ${firstPoint[1]} ${firstPoint[0]}))`;
  };

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        whenCreated={setMap}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FeatureGroup ref={featureGroupRef} />
      </MapContainer>

      {drawnCoordinates.length > 0 && (
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg z-[1000]">
          <h3 className="font-semibold text-sm mb-2">Drawn Parcel</h3>
          <p className="text-xs text-gray-600">
            {drawnCoordinates.length} points
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Center: {drawnCoordinates[0]?.[0].toFixed(6)}, {drawnCoordinates[0]?.[1].toFixed(6)}
          </p>
        </div>
      )}
    </div>
  );
}