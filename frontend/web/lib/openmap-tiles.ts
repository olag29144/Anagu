import type * as LType from 'leaflet';

export type OpenMapLayerId = 'osm' | 'hybrid' | 'satellite' | 'terrain' | 'dark';

export interface OpenMapLayerOption {
  id: OpenMapLayerId;
  label: string;
}

export const OPEN_MAP_LAYERS: OpenMapLayerOption[] = [
  { id: 'osm', label: 'OpenStreetMap' },
  { id: 'hybrid', label: 'Satellite + Labels' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'terrain', label: 'Topo GIS' },
  { id: 'dark', label: 'Dark GIS' },
];

export function createOpenMapTileLayer(
  L: typeof LType,
  layerId: OpenMapLayerId,
): LType.LayerGroup {
  const group = L.layerGroup();

  switch (layerId) {
    case 'osm': {
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 21,
        maxNativeZoom: 19,
      }).addTo(group);
      break;
    }
    case 'satellite': {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
          maxZoom: 21,
          maxNativeZoom: 18,
        },
      ).addTo(group);
      break;
    }
    case 'hybrid': {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Imagery &copy; Esri &middot; Labels &copy; CARTO / OSM',
          maxZoom: 21,
          maxNativeZoom: 18,
        },
      ).addTo(group);
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
        {
          subdomains: 'abcd',
          maxZoom: 21,
          maxNativeZoom: 19,
          pane: 'overlayPane',
        },
      ).addTo(group);
      break;
    }
    case 'terrain': {
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        subdomains: 'abc',
        attribution: '&copy; OpenStreetMap contributors, SRTM &middot; &copy; OpenTopoMap',
        maxZoom: 21,
        maxNativeZoom: 17,
      }).addTo(group);
      break;
    }
    case 'dark': {
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          subdomains: 'abcd',
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          maxZoom: 21,
          maxNativeZoom: 19,
        },
      ).addTo(group);
      break;
    }
  }

  return group;
}
