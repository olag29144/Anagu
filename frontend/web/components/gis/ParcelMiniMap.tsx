'use client';
import GISMap from './GISMap';
import type { LatLngPoint } from '@/lib/gis-utils';

interface ParcelMiniMapProps {
  parcelPaths: LatLngPoint[];
  className?: string;
}

export default function ParcelMiniMap({ parcelPaths, className }: ParcelMiniMapProps) {
  return (
    <div className={className}>
      <GISMap existingBoundary={parcelPaths} center={[8.9328677, 11.336599]} zoom={15} />
    </div>
  );
}
