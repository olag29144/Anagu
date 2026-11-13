'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const FeatureGroup = dynamic(() => import('react-leaflet').then((mod) => mod.FeatureGroup), { ssr: false });

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
  const [leaflet, setLeaflet] = useState<any>(null);
  const [leafletDraw, setLeafletDraw] = useState<any>(null);
  const featureGroupRef = useRef<any>(null);
  const [drawnCoordinates, setDrawnCoordinates] = useState<[number, number][]>([]);

  useEffect(() => {
    setMounted(true);
    
    // Dynamically import Leaflet and Leaflet Draw
    Promise.all([
      import('leaflet'),
      import('leaflet-draw')
    ]).then(([L, LD]) => {
      setLeaflet(L.default);
      setLeafletDraw(LD);
    });
  }, []);

  useEffect(() => {
    if (!map || !leaflet || !leafletDraw || !featureGroupRef.current) return;

    const drawControl = new leaflet.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          metric: true,
          shapeOptions: {
            color: '#3b82f6',
            weight: 2,
            fillOpacity: 0.2,
          },
        },
        rectangle: {
          shapeOptions: {
            color: '#3b82f6',
            weight: 2,
            fillOpacity: 0.2,
          },
        },
        polyline: false,
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

    map.on(leaflet.Draw.Event.CREATED, (event: any) => {
      const layer = event.layer;
      const latlngs = layer.getLatLngs()[0];
      const coords: [number, number][] = latlngs.map((ll: any) => [ll.lat, ll.lng]);
      
      setDrawnCoordinates(coords);
      
      // Convert to WKT format for PostGIS (lng, lat order)
      const wktCoords = coords.map(([lat, lng]) => `${lng} ${lat}`).join(', ');
      const wkt = `SRID=4326;POLYGON((${wktCoords}, ${coords[0][1]} ${coords[0][0]}))`;
      
      if (onBoundaryDrawn) {
        onBoundaryDrawn(wkt, coords);
      }

      featureGroupRef.current?.clearLayers();
      featureGroupRef.current?.addLayer(layer);
    });

    return () => {
      map.off(leaflet.Draw.Event.CREATED);
      map.removeControl(drawControl);
    };
  }, [map, leaflet, leafletDraw, onBoundaryDrawn]);

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
        <FeatureGroup ref={featureGroupRef} />
      </MapContainer>

      {drawnCoordinates.length > 0 && (
        <div className="absolute top-4 right-4 bg-[#0A0F16] border border-[#38BDF8]/30 p-4 rounded-lg shadow-lg z-[1000] max-w-xs">
          <h3 className="font-semibold text-sm text-[#F4F7FB] mb-2">✓ Parcel Drawn</h3>
          <p className="text-xs text-[#94A3B8]">
            {drawnCoordinates.length} boundary points
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            Center: {drawnCoordinates[0]?.[0].toFixed(6)}, {drawnCoordinates[0]?.[1].toFixed(6)}
          </p>
          <p className="text-[11px] text-[#38BDF8] mt-2">
            Coordinates auto-filled below
          </p>
        </div>
      )}

      <div className="absolute top-4 left-4 bg-[#0A0F16] border border-[#1E293B] p-3 rounded-lg shadow-lg z-[1000]">
        <p className="text-xs text-[#94A3B8] font-mono">
          📍 Use the drawing tools on the left to draw your parcel boundary
        </p>
      </div>
    </div>
  );
}