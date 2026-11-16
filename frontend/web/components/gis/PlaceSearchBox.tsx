'use client';
import { Search } from 'lucide-react';
import { useState } from 'react';

interface PlaceSearchBoxProps {
  onPlaceSelect?: (place: any) => void;
}

export default function PlaceSearchBox({ onPlaceSelect }: PlaceSearchBoxProps) {
  const [search, setSearch] = useState('');
  
  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-white rounded-md px-3 py-2 border">
        <Search size={18} className="text-gray-500" />
        <input
          type="text"
          placeholder="Search location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 outline-none text-black"
        />
      </div>
    </div>
  );
}
