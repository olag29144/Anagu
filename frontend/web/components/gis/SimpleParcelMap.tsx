'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

// Dynamic import to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

export default function SimpleParcelMap({ center = [9.0765, 7.3986], zoom = 6 }) {
  const [mapReady, setMapReady] = useState(false);

  return (
    <div className="w-full h-[500px] rounded-lg overflow-hidden border">
      {typeof window !== 'undefined' && (
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          whenReady={() => setMapReady(true)}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={center}>
            <Popup>Land parcel location</Popup>
          </Marker>
        </MapContainer>
      )}
    </div>
  );
}
