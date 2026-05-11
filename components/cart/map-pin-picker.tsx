'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapPinPickerProps {
  lat: number | null
  lng: number | null
  city: string
  onCoordsChange: (lat: number | null, lng: number | null) => void
}

// Coordenadas base de las ciudades
const CITY_COORDS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'Concepcion del Uruguay': { lat: -32.4844, lng: -58.2327, zoom: 14 },
  'Colon': { lat: -32.2237, lng: -58.1412, zoom: 14 },
  'Gualeguaychu': { lat: -33.0094, lng: -58.5172, zoom: 14 },
  'San Salvador': { lat: -31.6232, lng: -58.5048, zoom: 14 },
}

const DEFAULT_CENTER = { lat: -32.4844, lng: -58.2327, zoom: 13 }

function createPinIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: hsl(173, 80%, 36%);
      color: white;
      border-radius: 50% 50% 50% 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid white;
    "><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg)"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  })
}

export default function MapPinPicker({ lat, lng, city, onCoordsChange }: MapPinPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [hasPin, setHasPin] = useState(lat != null && lng != null)

  useEffect(() => {
    if (!mapRef.current) return

    // Limpiar mapa anterior
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }

    const cityCoords = CITY_COORDS[city] || DEFAULT_CENTER
    const center = lat != null && lng != null ? { lat, lng } : cityCoords
    const zoom = lat != null && lng != null ? 16 : cityCoords.zoom

    const map = L.map(mapRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    })

    mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OSM',
      maxZoom: 19,
    }).addTo(map)

    // Si ya hay coordenadas, poner marker
    if (lat != null && lng != null) {
      const marker = L.marker([lat, lng], {
        icon: createPinIcon(),
        draggable: true,
      }).addTo(map)

      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onCoordsChange(pos.lat, pos.lng)
      })

      markerRef.current = marker
    }

    // Click en el mapa para poner/mover pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng

      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng])
      } else {
        const marker = L.marker([clickLat, clickLng], {
          icon: createPinIcon(),
          draggable: true,
        }).addTo(map)

        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onCoordsChange(pos.lat, pos.lng)
        })

        markerRef.current = marker
      }

      onCoordsChange(clickLat, clickLng)
      setHasPin(true)
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [city]) // Solo re-crear cuando cambia la ciudad

  // Sync marker position cuando cambian lat/lng desde afuera
  useEffect(() => {
    if (markerRef.current && lat != null && lng != null) {
      markerRef.current.setLatLng([lat, lng])
    }
  }, [lat, lng])

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg overflow-hidden border border-border" style={{ height: 200 }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        {hasPin ? 'Toca el mapa o arrastra el pin para ajustar la ubicacion' : 'Toca el mapa para marcar la ubicacion de entrega'}
      </p>
    </div>
  )
}
