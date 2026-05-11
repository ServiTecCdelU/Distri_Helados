'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Order } from '@/lib/types'
import {
  MapPin,
  Navigation,
  Clock,
  Fuel,
  Loader2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react'
import dynamic from 'next/dynamic'

// Importar Leaflet dinamicamente (SSR no soportado)
const RouteMapView = dynamic(() => import('./route-map-view'), { ssr: false })

interface RouteMapModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: Order[]
}

interface GeocodedOrder {
  order: Order
  lat: number
  lng: number
  fullAddress: string
  isEntryPoint?: 'inicio' | 'fin'
}

interface RouteResult {
  waypoints: GeocodedOrder[]
  geometry: [number, number][]
  totalDistance: number // metros
  totalDuration: number // segundos
}

// Coordenadas base de las ciudades (Entre Rios, Argentina)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Concepcion del Uruguay': { lat: -32.4844, lng: -58.2327 },
  'Colon': { lat: -32.2237, lng: -58.1412 },
  'Gualeguaychu': { lat: -33.0094, lng: -58.5172 },
  'San Salvador': { lat: -31.6232, lng: -58.5048 },
}

// Punto de ingreso/salida de cada ciudad (rotonda/acceso Ruta Nacional 14)
const CITY_ENTRY_POINTS: Record<string, { lat: number; lng: number; label: string }> = {
  'Concepcion del Uruguay': { lat: -32.4773, lng: -58.2830, label: 'Ruta 14 - Acceso C. del Uruguay' },
  'Colon': { lat: -32.2283, lng: -58.1791, label: 'Ruta 14 - Acceso Colon' },
  'Gualeguaychu': { lat: -33.0123, lng: -58.5360, label: 'Ruta 14 - Acceso Gualeguaychu' },
  'San Salvador': { lat: -31.6267, lng: -58.5117, label: 'Ruta 14 - Acceso San Salvador' },
}

// Geocodificar una direccion usando Nominatim
async function geocodeAddress(address: string, city: string): Promise<{ lat: number; lng: number } | null> {
  const fullAddress = `${address}, ${city}, Entre Rios, Argentina`
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1&countrycodes=ar`,
      { headers: { 'Accept-Language': 'es' } }
    )
    const data = await res.json()
    if (data.length > 0) {
      const lat = parseFloat(data[0].lat)
      const lng = parseFloat(data[0].lng)
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng }
    }
    // Fallback: intentar solo con la calle y ciudad
    const fallbackRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&country=Argentina&limit=1`,
      { headers: { 'Accept-Language': 'es' } }
    )
    const fallbackData = await fallbackRes.json()
    if (fallbackData.length > 0) {
      const lat = parseFloat(fallbackData[0].lat)
      const lng = parseFloat(fallbackData[0].lng)
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng }
    }
    return null
  } catch {
    return null
  }
}

// Obtener ruta optimizada de OSRM
async function getOptimizedRoute(coords: { lat: number; lng: number }[]): Promise<{
  orderedIndices: number[]
  geometry: [number, number][]
  distance: number
  duration: number
} | null> {
  if (coords.length < 2) return null

  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';')
  try {
    const res = await fetch(
      `https://router.project-osrm.org/trip/v1/driving/${coordStr}?overview=full&geometries=geojson&roundtrip=false&source=first&destination=last`
    )
    const data = await res.json()
    if (data.code !== 'Ok' || !data.trips?.[0]) return null

    const trip = data.trips[0]

    // data.waypoints contiene los waypoints en el MISMO orden de input
    // waypoint_index indica la posicion del waypoint en el trip optimizado
    // Para reconstruir el orden optimo: crear array ordenado por waypoint_index
    const wpArray: { originalIndex: number; tripIndex: number }[] = data.waypoints.map(
      (wp: any, i: number) => ({ originalIndex: i, tripIndex: wp.waypoint_index })
    )
    wpArray.sort((a, b) => a.tripIndex - b.tripIndex)
    const orderedIndices = wpArray.map(wp => wp.originalIndex)

    const geometry: [number, number][] = trip.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]] // GeoJSON es [lng, lat], Leaflet necesita [lat, lng]
    )

    return {
      orderedIndices,
      geometry,
      distance: trip.distance,
      duration: trip.duration,
    }
  } catch {
    return null
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins} min`
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

export function RouteMapModal({ open, onOpenChange, orders }: RouteMapModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geocodedOrders, setGeocodedOrders] = useState<GeocodedOrder[]>([])
  const [failedOrders, setFailedOrders] = useState<Order[]>([])
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [showStopsList, setShowStopsList] = useState(false)

  // Filtrar pedidos con direccion valida
  const validOrders = useMemo(() =>
    orders.filter(o => o.address && o.city && o.status !== 'completed'),
    [orders]
  )

  const calculateRoute = useCallback(async () => {
    if (validOrders.length === 0) return

    setLoading(true)
    setError(null)
    setFailedOrders([])
    setRouteResult(null)

    try {
      // Paso 1: Geocodificar todas las direcciones
      const geocoded: GeocodedOrder[] = []
      const failed: Order[] = []

      // Separar pedidos con coordenadas guardadas de los que necesitan geocoding
      const needsGeocoding: Order[] = []
      for (const order of validOrders) {
        if (order.lat != null && order.lng != null && !isNaN(order.lat) && !isNaN(order.lng)) {
          geocoded.push({
            order,
            lat: order.lat,
            lng: order.lng,
            fullAddress: `${order.address}, ${order.city}`,
          })
        } else {
          needsGeocoding.push(order)
        }
      }

      // Geocodificar los que no tienen coordenadas (con delay para rate limit de Nominatim)
      for (const order of needsGeocoding) {
        const coords = await geocodeAddress(order.address, order.city || '')

        if (coords) {
          geocoded.push({
            order,
            lat: coords.lat,
            lng: coords.lng,
            fullAddress: `${order.address}, ${order.city}`,
          })
        } else {
          // Usar coordenadas de la ciudad como fallback
          const cityCoords = CITY_COORDS[order.city || '']
          if (cityCoords) {
            geocoded.push({
              order,
              lat: cityCoords.lat + (Math.random() - 0.5) * 0.005,
              lng: cityCoords.lng + (Math.random() - 0.5) * 0.005,
              fullAddress: `${order.address}, ${order.city} (ubicacion aproximada)`,
            })
          } else {
            failed.push(order)
          }
        }

        // Respetar rate limit de Nominatim
        await new Promise(r => setTimeout(r, 1100))
      }

      setGeocodedOrders(geocoded)
      setFailedOrders(failed)

      if (geocoded.length === 0) {
        setError('No se pudieron geocodificar suficientes direcciones para trazar una ruta.')
        setLoading(false)
        return
      }

      // Paso 2: Determinar punto de entrada/salida de la ciudad
      // Usar la ciudad mas frecuente entre los pedidos
      const cityCounts: Record<string, number> = {}
      validOrders.forEach(o => {
        if (o.city) cityCounts[o.city] = (cityCounts[o.city] || 0) + 1
      })
      const mainCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
      const entryPoint = CITY_ENTRY_POINTS[mainCity]

      // Crear waypoints de inicio y fin
      const dummyOrder: Order = { id: '__entry__', items: [], status: 'delivery', address: '', createdAt: new Date(), updatedAt: new Date() }
      const startWp: GeocodedOrder = entryPoint
        ? { order: dummyOrder, lat: entryPoint.lat, lng: entryPoint.lng, fullAddress: entryPoint.label, isEntryPoint: 'inicio' }
        : { order: dummyOrder, lat: geocoded[0].lat, lng: geocoded[0].lng, fullAddress: 'Inicio', isEntryPoint: 'inicio' }
      const endWp: GeocodedOrder = entryPoint
        ? { order: { ...dummyOrder, id: '__exit__' }, lat: entryPoint.lat, lng: entryPoint.lng, fullAddress: entryPoint.label, isEntryPoint: 'fin' }
        : { order: { ...dummyOrder, id: '__exit__' }, lat: geocoded[0].lat, lng: geocoded[0].lng, fullAddress: 'Fin', isEntryPoint: 'fin' }

      // Armar array completo: [inicio, ...paradas, fin]
      const allPoints = [startWp, ...geocoded, endWp]
      const coords = allPoints.map(g => ({ lat: g.lat, lng: g.lng }))

      // Paso 3: Optimizar ruta con OSRM (source=first, destination=last)
      const route = await getOptimizedRoute(coords)

      if (!route) {
        // Sin optimizacion, usar orden con inicio y fin
        setRouteResult({
          waypoints: allPoints,
          geometry: allPoints.map(g => [g.lat, g.lng] as [number, number]),
          totalDistance: 0,
          totalDuration: 0,
        })
        setLoading(false)
        return
      }

      // Reordenar waypoints segun la ruta optima
      const optimizedWaypoints = route.orderedIndices
        .map((idx: number) => allPoints[idx])
        .filter((wp): wp is GeocodedOrder => wp != null)

      setRouteResult({
        waypoints: optimizedWaypoints,
        geometry: route.geometry,
        totalDistance: route.distance,
        totalDuration: route.duration,
      })
    } catch (err) {
      setError('Error al calcular la ruta. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }, [validOrders])

  useEffect(() => {
    if (open && validOrders.length > 0 && !routeResult && !loading) {
      calculateRoute()
    }
  }, [open, validOrders.length])

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setRouteResult(null)
      setGeocodedOrders([])
      setFailedOrders([])
      setError(null)
      setShowStopsList(false)
    }
  }, [open])

  // Abrir en Google Maps con los waypoints en orden optimizado
  const openInGoogleMaps = () => {
    if (!routeResult || routeResult.waypoints.length === 0) return

    const waypoints = routeResult.waypoints
    const origin = `${waypoints[0].lat},${waypoints[0].lng}`
    const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`

    if (waypoints.length > 2) {
      const middleWaypoints = waypoints
        .slice(1, -1)
        .map(wp => `${wp.lat},${wp.lng}`)
        .join('|')
      url += `&waypoints=${middleWaypoints}`
    }

    url += '&travelmode=driving'
    window.open(url, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            Ruta de Entrega Optimizada
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4 space-y-4">
          {/* Estado de carga */}
          {loading && (
            <Card className="border-primary/20">
              <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-foreground">Calculando ruta optima...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Procesando {validOrders.length} direcciones y optimizando el recorrido
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={calculateRoute} className="ml-auto shrink-0">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Resultado */}
          {routeResult && !loading && (
            <>
              {/* Stats de la ruta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="p-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Paradas</p>
                      <p className="font-bold text-foreground">{routeResult.waypoints.filter(wp => !wp.isEntryPoint).length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
                  <CardContent className="p-3 flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Distancia</p>
                      <p className="font-bold text-foreground">{formatDistance(routeResult.totalDistance)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
                  <CardContent className="p-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Tiempo est.</p>
                      <p className="font-bold text-foreground">{formatDuration(routeResult.totalDuration)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
                  <CardContent className="p-3 flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Combustible est.</p>
                      <p className="font-bold text-foreground">
                        {(routeResult.totalDistance / 1000 / 10).toFixed(1)} L
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Direcciones que no se pudieron geocodificar */}
              {failedOrders.length > 0 && (
                <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{failedOrders.length} pedido(s) sin ubicacion: {failedOrders.map(o => o.clientName || o.address).join(', ')}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Mapa */}
              <div className="rounded-xl overflow-hidden border border-border" style={{ height: 400 }}>
                <RouteMapView
                  waypoints={routeResult.waypoints}
                  routeGeometry={routeResult.geometry}
                />
              </div>

              {/* Lista de paradas en orden */}
              <div>
                <button
                  onClick={() => setShowStopsList(!showStopsList)}
                  className="flex items-center gap-2 w-full text-left font-semibold text-foreground py-2"
                >
                  {showStopsList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Orden de paradas ({routeResult.waypoints.length})
                </button>
                {showStopsList && (
                  <div className="space-y-2 mt-2">
                    {(() => {
                      let stopNum = 1
                      return routeResult.waypoints.map((wp) => {
                        if (wp.isEntryPoint) {
                          const isStart = wp.isEntryPoint === 'inicio'
                          return (
                            <div key={wp.order.id} className={`flex items-start gap-3 p-3 rounded-lg border-2 ${isStart ? 'border-green-300 bg-green-50 dark:bg-green-900/10 dark:border-green-800' : 'border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-800'}`}>
                              <div className={`flex items-center justify-center h-8 px-3 rounded-full font-bold text-xs shrink-0 text-white ${isStart ? 'bg-green-500' : 'bg-red-500'}`}>
                                {isStart ? 'INICIO' : 'FIN'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground">{isStart ? 'Inicio del recorrido' : 'Fin del recorrido'}</p>
                                <p className="text-sm text-muted-foreground truncate">{wp.fullAddress}</p>
                              </div>
                            </div>
                          )
                        }
                        const num = stopNum++
                        return (
                          <div key={wp.order.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                              {num}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground truncate">{wp.order.clientName || 'Sin cliente'}</p>
                              <p className="text-sm text-muted-foreground truncate">{wp.fullAddress}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  {wp.order.items.length} producto(s)
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-2">
                <Button onClick={openInGoogleMaps} className="flex-1 gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Abrir en Google Maps
                </Button>
                <Button variant="outline" onClick={calculateRoute} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Recalcular
                </Button>
              </div>
            </>
          )}

          {/* Sin pedidos */}
          {validOrders.length === 0 && !loading && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MapPin className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="font-semibold text-foreground">No hay pedidos con direccion</p>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  Solo se incluyen pedidos pendientes/en preparacion/en entrega con ciudad y direccion asignada
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
