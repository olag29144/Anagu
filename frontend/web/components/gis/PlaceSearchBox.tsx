'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, Loader2, MapPin, X } from 'lucide-react';
import { triggerQuotaWarningIfNeeded } from './MapsContextProvider';
import { matchNigerianState } from '@/lib/gis-utils';

export interface SelectedPlaceResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  displayName: string;
  matchedState: string | null;
  viewport?: google.maps.LatLngBounds | null;
}

interface PlaceSearchBoxProps {
  onPlaceSelect: (result: SelectedPlaceResult) => void;
  placeholder?: string;
}

export function PlaceSearchBox({
  onPlaceSelect,
  placeholder = 'Search Nigerian street, estate, LGA, or landmark (e.g. Lekki Phase 1, Maitama)...',
}: PlaceSearchBoxProps) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
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
    if (!placesLib || trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      setIsLoading(true);
      setSearchError(null);

      const request: google.maps.places.AutocompleteRequest = {
        input: trimmed,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ['ng'],
      };

      AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
        .then((res) => {
          setSuggestions(res?.suggestions ?? []);
          setIsOpen(true);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          setIsLoading(false);
          setSuggestions([]);
          if (!triggerQuotaWarningIfNeeded(err)) {
            setSearchError('Place suggestions temporarily unavailable.');
          }
        });
    }, 240);

    return () => window.clearTimeout(timer);
  }, [placesLib, inputValue]);

  const handleSelect = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      setIsLoading(true);
      setSearchError(null);

      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
        });

        const loc = place.location;
        if (loc) {
          const formattedAddress =
            place.formattedAddress ||
            suggestion.placePrediction.text?.text ||
            place.displayName ||
            '';
          const displayName = place.displayName || formattedAddress;
          const matchedState = matchNigerianState(formattedAddress);

          onPlaceSelect({
            lat: loc.lat(),
            lng: loc.lng(),
            formattedAddress,
            displayName,
            matchedState,
            viewport: place.viewport ?? null,
          });
          setInputValue(formattedAddress);
        }
      } catch (err: unknown) {
        if (!triggerQuotaWarningIfNeeded(err)) {
          setSearchError('Could not load coordinates for this location.');
        }
      } finally {
        sessionTokenRef.current = null;
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
      }
    },
    [placesLib, onPlaceSelect],
  );

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
          placeholder={placeholder}
          aria-label="Search land address or neighborhood"
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
        <ul className="absolute z-40 mt-1.5 w-full rounded-[10px] bg-[#0A0F16] border border-[rgba(91,133,167,0.35)] shadow-2xl overflow-hidden divide-y divide-[rgba(91,133,167,0.14)] max-h-64 overflow-y-auto">
          {suggestions.map((suggestion, idx) => {
            const label = suggestion.placePrediction?.text?.text || 'Unnamed location';
            return (
              <li key={suggestion.placePrediction?.placeId || idx}>
                <button
                  type="button"
                  onClick={() => void handleSelect(suggestion)}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-[#E2E8F0] hover:bg-[#38BDF8]/15 hover:text-[#F4F7FB] flex items-start gap-2.5 transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#38BDF8] shrink-0 mt-0.5" />
                  <span className="leading-snug">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
