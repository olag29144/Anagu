'use client';
import GISMap from './GISMap';
import type { LatLngPoint } from '@/lib/gis-utils';

interface Parcel {
  id: string;
  paths: LatLngPoint[];
  owner?: string;
}

interface ExploreParcelsMapProps {
  parcels: Parcel[];
}

export default function ExploreParcelsMap({ parcels }: ExploreParcelsMapProps) {
  return (
    <div className="w-full">
      <GISMap 
        center={[8.9328677, 11.336599]} 
        zoom={13}
        existingBoundary={parcels[0]?.paths || []}
      />
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">Parcels ({parcels.length})</h3>
        {parcels.map(p => (
          <div key={p.id} className="text-sm">
            Parcel #{p.id} - {p.paths.length} points
          </div>
        ))}
      </div>
    </div>
  );
}
