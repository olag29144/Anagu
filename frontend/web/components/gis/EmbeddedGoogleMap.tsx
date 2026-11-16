'use client';

import { useState } from 'react';

interface EmbeddedMapProps {
  lat?: number;
  lng?: number;
  zoom?: number;
  className?: string;
}

export default function EmbeddedGoogleMap({ 
  lat = 8.9328677, 
  lng = 11.336599, 
  zoom = 15,
  className = "w-full h-[500px]"
}: EmbeddedMapProps) {
  // Build Google Maps embed URL
  const embedUrl = `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d${zoom}!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sng!4v1234567890`;

  return (
    <div className={className}>
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={embedUrl}
      />
    </div>
  );
}
