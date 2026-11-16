'use client';
import GISMap from './GISMap';

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface ParcelMiniMapProps {
  parcelPaths?: LatLngPoint[];
  className?: string;
}

export default function ParcelMiniMap({ parcelPaths = [], className }: ParcelMiniMapProps) {
  const center: [number, number] = parcelPaths.length > 0
    ? [
        parcelPaths.reduce((sum, p) => sum + p.lat, 0) / parcelPaths.length,
        parcelPaths.reduce((sum, p) => sum + p.lng, 0) / parcelPaths.length
      ]
    : [8.9328677, 11.336599];

  return (
    <div className={className}>
      <GISMap center={center} zoom={15} existingBoundary={parcelPaths} />
    </div>
  );
}
