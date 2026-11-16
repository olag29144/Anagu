'use client';

export interface GisMeasurementPayload {
  points: any[];
  areaSqMeters: number;
}

export default function LandGisMapper() {
  return (
    <div className="w-full h-[600px] bg-gray-200 rounded-lg flex items-center justify-center">
      <p className="text-gray-600">Land GIS Mapper - Coming Soon</p>
    </div>
  );
}
