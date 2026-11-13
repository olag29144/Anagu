'use client';

import { useEffect, useState } from 'react';

export default function ParcelMap() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[500px] bg-[#05080D] border border-[#1E293B] rounded-lg flex items-center justify-center">
        <p className="text-xs text-[#64748B]">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[500px] bg-[#05080D] border border-[#1E293B] rounded-lg p-4">
      <p className="text-sm text-[#F4F7FB] mb-4">Interactive Map (Coming Soon)</p>
      <p className="text-xs text-[#94A3B8]">Map functionality will be available after build fixes are deployed.</p>
    </div>
  );
}