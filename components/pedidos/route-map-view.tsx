'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Waypoint {
  order: { id: string; clientName?: string }
  lat: number
  lng: number
  fullAddress: string
  isEntryPoint?: 'inicio' | 'fin'
}

interface RouteMapViewProps {
  waypoints: Waypoint[]
  routeGeometry: [number, number][]
}

// Crear icono numerado para paradas regulares
function createNumberedIcon(number: number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: hsl(173, 80%, 36%);
      color: white;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid white;
    ">${number}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  })
}

// Crear icono para punto de inicio/fin
function createEntryIcon(type: 'inicio' | 'fin') {
  const color = type === 'inicio' ? '#22c55e' : '#ef4444' // verde / rojo
  const label = type === 'inicio' ? 'INICIO' : 'FIN'
  return L.divIcon({
    className: '',
    html: `<div style="
      background: ${color};
      color: white;
      border-radius: 8px;
      padding: 4px 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      border: 2px solid white;
      white-space: nowrap;
    ">${label}</div>`,
    iconSize: [60, 28],
    iconAnchor: [30, 14],
    popupAnchor: [0, -18],
  })
}

export default function RouteMapView({ waypoints, routeGeometry }: RouteMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || waypoints.length === 0) return

    // Limpiar mapa anterior
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    })

    mapInstanceRef.current = map

    // Tile layer de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Agregar markers (filtrar NaN)
    const validWaypoints = waypoints.filter(wp =>
      typeof wp.lat === 'number' && typeof wp.lng === 'number' &&
      !isNaN(wp.lat) && !isNaN(wp.lng) && isFinite(wp.lat) && isFinite(wp.lng)
    )

    if (validWaypoints.length === 0) return

    const bounds = L.latLngBounds([])
    let stopNumber = 1

    validWaypoints.forEach((wp) => {
      let icon: L.DivIcon
      let popupContent: string

      if (wp.isEntryPoint) {
        icon = createEntryIcon(wp.isEntryPoint)
        popupContent = `
          <div style="min-width: 140px;">
            <strong style="font-size: 14px; color: ${wp.isEntryPoint === 'inicio' ? '#22c55e' : '#ef4444'}">
              ${wp.isEntryPoint === 'inicio' ? 'INICIO' : 'FIN'} del recorrido
            </strong>
            <br/>
            <span style="color: #666; font-size: 12px;">${wp.fullAddress}</span>
          </div>
        `
      } else {
        icon = createNumberedIcon(stopNumber)
        popupContent = `
          <div style="min-width: 150px;">
            <strong style="font-size: 14px;">${stopNumber}. ${wp.order.clientName || 'Sin cliente'}</strong>
            <br/>
            <span style="color: #666; font-size: 12px;">${wp.fullAddress}</span>
          </div>
        `
        stopNumber++
      }

      const marker = L.marker([wp.lat, wp.lng], { icon }).addTo(map)
      marker.bindPopup(popupContent)
      bounds.extend([wp.lat, wp.lng])
    })

    // Dibujar ruta (filtrar puntos invalidos)
    const validGeometry = routeGeometry.filter(
      point => !isNaN(point[0]) && !isNaN(point[1]) && isFinite(point[0]) && isFinite(point[1])
    )
    if (validGeometry.length > 1) {
      L.polyline(validGeometry, {
        color: 'hsl(173, 80%, 36%)',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 6',
      }).addTo(map)

      // Agregar todos los puntos de la geometria al bounds
      validGeometry.forEach(point => bounds.extend(point))
    }

    // Ajustar vista al bounds
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] })
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [waypoints, routeGeometry])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
