'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Search, Loader2, MapPin, X } from 'lucide-react';
import { NIGERIA_GIS_HUBS, matchNigerianState } from '@/lib/gis-utils';

export interface SelectedPlaceResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  displayName: string;
  matchedState: string | null;
  boundingBox?: [[number, number], [number, number]] | null;
}

interface PlaceSuggestion {
  id: string;
  displayName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  matchedState: string | null;
  boundingBox?: [[number, number], [number, number]] | null;
  source: 'hub' | 'osm';
}

interface NominatimItem {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
  address?: {
    state?: string;
    city?: string;
    town?: string;
    suburb?: string;
    road?: string;
  };
}

interface PlaceSearchBoxProps {
  onPlaceSelect: (result: SelectedPlaceResult) => void;
  placeholder?: string;
}

export function PlaceSearchBox({
  onPlaceSelect,
  placeholder = 'Search Nigerian street, estate, LGA, or landmark (e.g. Lekki Phase 1, Maitama)...',
}: PlaceSearchBoxProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setSearchError(null);
      return;
    }

    const qLower = trimmed.toLowerCase();
    const localMatches: PlaceSuggestion[] = NIGERIA_GIS_HUBS.filter(
      (hub) =>
        hub.label.toLowerCase().includes(qLower) ||
        hub.state.toLowerCase().includes(qLower),
    ).map((hub) => ({
      id: `hub-${hub.label}`,
      displayName: hub.label,
      formattedAddress: `${hub.label}, ${hub.state}, Nigeria`,
      lat: hub.center.lat,
      lng: hub.center.lng,
      matchedState: hub.state,
      boundingBox: null,
      source: 'hub',
    }));

    if (localMatches.length > 0) {
      setSuggestions(localMatches);
      setIsOpen(true);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setSearchError(null);

      try {
        const fetchNominatim = async (restrictNigeria: boolean) => {
          const url = new URL('https://nominatim.openstreetmap.org/search');
          url.searchParams.set('format', 'jsonv2');
          url.searchParams.set('addressdetails', '1');
          if (restrictNigeria) {
            url.searchParams.set('countrycodes', 'ng');
          }
          url.searchParams.set('limit', '6');
          url.searchParams.set('q', trimmed);

          const res = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
            },
          });
          if (!res.ok) {
            throw new Error(`OpenStreetMap geocoder returned ${res.status}`);
          }
          return (await res.json()) as NominatimItem[];
        };

        let data = await fetchNominatim(true);
        if (!Array.isArray(data) || data.length === 0) {
          data = await fetchNominatim(false);
        }

        const osmResults: PlaceSuggestion[] = (Array.isArray(data) ? data : [])
          .map((item) => {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            let boundingBox: [[number, number], [number, number]] | null = null;
            if (Array.isArray(item.boundingbox) && item.boundingbox.length === 4) {
              const south = parseFloat(item.boundingbox[0]);
              const north = parseFloat(item.boundingbox[1]);
              const west = parseFloat(item.boundingbox[2]);
              const east = parseFloat(item.boundingbox[3]);
              if (
                Number.isFinite(south) &&
                Number.isFinite(north) &&
                Number.isFinite(west) &&
                Number.isFinite(east)
              ) {
                boundingBox = [
                  [south, west],
                  [north, east],
                ];
              }
            }

            const stateHint = item.address?.state || item.display_name;
            const matchedState = matchNigerianState(stateHint);

            const suggestion: PlaceSuggestion = {
              id: `osm-${item.place_id}`,
              displayName:
                item.name ||
                item.address?.suburb ||
                item.address?.town ||
                item.address?.city ||
                item.display_name.split(',')[0] ||
                'Location',
              formattedAddress: item.display_name,
              lat,
              lng,
              matchedState,
              boundingBox,
              source: 'osm',
            };
            return suggestion;
          })
          .filter((item): item is PlaceSuggestion => Boolean(item));

        const combined = [...localMatches];
        for (const osmItem of osmResults) {
          const duplicate = combined.some(
            (existing) =>
              Math.abs(existing.lat - osmItem.lat) < 0.005 &&
              Math.abs(existing.lng - osmItem.lng) < 0.005,
          );
          if (!duplicate) combined.push(osmItem);
        }

        setSuggestions(combined);
        setIsOpen(combined.length > 0);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        if (localMatches.length === 0) {
          setSearchError('Address lookup temporarily unavailable. Pick a quick area or pan the map.');
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [inputValue]);

  const handleSelect = (item: PlaceSuggestion) => {
    onPlaceSelect({
      lat: item.lat,
      lng: item.lng,
      formattedAddress: item.formattedAddress,
      displayName: item.displayName,
      matchedState: item.matchedState,
      boundingBox: item.boundingBox ?? null,
    });
    setInputValue(item.formattedAddress);
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#38BDF8]" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (e.target.value.trim().length >= 2) setIsOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (suggestions.length > 0) {
                handleSelect(suggestions[0]);
              }
            }
          }}
          placeholder={placeholder}
          aria-label="Search land address or neighborhood on map"
          className="w-full h-11 pl-10 pr-10 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.28)] text-sm text-[#F4F7FB] placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#38BDF8] animate-spin" />
        ) : (
          inputValue && (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                setSuggestions([]);
                setIsOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#F4F7FB]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>

      {searchError && (
        <p className="mt-1 text-[11px] text-amber-300">{searchError}</p>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-[1200] mt-1.5 w-full rounded-[10px] bg-[#0A0F16] border border-[rgba(91,133,167,0.35)] shadow-2xl overflow-hidden divide-y divide-[rgba(91,133,167,0.14)] max-h-64 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => handleSelect(suggestion)}
                className="w-full px-3.5 py-2.5 text-left text-xs text-[#E2E8F0] hover:bg-[#38BDF8]/15 hover:text-[#F4F7FB] flex items-start justify-between gap-2.5 transition-colors"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="h-3.5 w-3.5 text-[#38BDF8] shrink-0 mt-0.5" />
                  <span className="leading-snug">{suggestion.formattedAddress}</span>
                </div>
                <span className="text-[10px] font-mono text-[#64748B] shrink-0 mt-0.5">
                  {suggestion.source === 'hub' ? 'GIS Hub' : 'OSM'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
