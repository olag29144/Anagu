'use client';

import type { LatLngPoint } from '@/lib/gis-utils';

interface InteractivePolygonProps {
  paths: LatLngPoint[];
  editable?: boolean;
  draggable?: boolean;
  fillColor?: string;
  strokeColor?: string;
  onPathsChange?: (paths: LatLngPoint[]) => void;
}

export function InteractivePolygon({ 
  paths, 
  editable, 
  draggable,
  fillColor,
  strokeColor,
  onPathsChange 
}: InteractivePolygonProps) {
  // Stub component - renders nothing for now
  return null;
}
