'use client';
import { useState } from 'react';
import GISMap from './GISMap';
import type { LatLngPoint } from '@/lib/gis-utils';

interface LandGisMapperProps {
  onBoundaryComplete: (points: LatLngPoint[]) => void;
  initialBoundary?: LatLngPoint[];
}

export default function LandGisMapper({ onBoundaryComplete, initialBoundary }: LandGisMapperProps) {
  return (
    <div className="space-y-4">
      <GISMap 
        center={[8.9328677, 11.336599]} 
        zoom={15}
        onBoundaryDraw={onBoundaryComplete}
        existingBoundary={initialBoundary}
      />
    </div>
  );
}
