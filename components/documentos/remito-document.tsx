'use client'

import { forwardRef } from 'react'
import Image from 'next/image'
import { Truck, MapPin, Phone, Calendar, User } from 'lucide-react'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils/format'

interface RemitoItem {
  name: string
  quantity: number
  price: number
}

interface RemitoDocumentProps {
  remitoNumber: string
  date: Date
  saleId: string
  clientName?: string
  clientAddress?: string
  clientPhone?: string
  sellerName?: string
  items: RemitoItem[]
  total: number
  notes?: string
}

export const RemitoDocument = forwardRef<HTMLDivElement, RemitoDocumentProps>(
  (
    {
      remitoNumber,
      date,
      saleId,
      clientName,
      clientAddress,
      clientPhone,
      sellerName,
      items,
      total,
      notes,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className="bg-white text-black p-8 w-[210mm] min-h-[297mm] mx-auto"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        {/* Header con gradiente */}
        <div className="relative bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl p-6 mb-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
          
          <div className="relative flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-white rounded-xl shadow-lg flex items-center justify-center overflow-hidden">
                <Image 
                  src="/logo.png" 
                  alt="Helados Mio" 
                  width={64} 
                  height={64}
                  className="object-contain"
                />
              </div>
              <div className="text-white">
                <h1 className="text-3xl font-bold tracking-tight">Helados Mío</h1>
                <p className="text-cyan-100 text-sm font-medium mt-1">Distribuidora</p>
              </div>
            </div>

            <div className="text-right">
              <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/30 mb-3">
                <p className="text-xs text-cyan-100 font-medium uppercase tracking-wider">Remito</p>
                <p className="text-2xl font-bold text-white">{remitoNumber}</p>
              </div>
              <div className="text-cyan-50 text-sm space-y-1">
                <div className="flex items-center justify-end gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(date)} - {formatTime(date)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Cliente */}
          <div className="border-2 border-cyan-200 rounded-xl p-5 bg-gradient-to-br from-cyan-50 to-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Cliente</h3>
            </div>
            <p className="font-bold text-gray-900 text-lg mb-2">{clientName || 'Consumidor Final'}</p>
            {clientPhone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4 text-cyan-500" />
                <span>{clientPhone}</span>
              </div>
            )}
          </div>

          {/* Entrega */}
          <div className="border-2 border-blue-200 rounded-xl p-5 bg-gradient-to-br from-blue-50 to-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Entrega</h3>
            </div>
            <p className="text-gray-700 text-sm mb-2">{clientAddress || 'Retiro en local'}</p>
            {sellerName && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-3 pt-3 border-t border-blue-200">
                <Truck className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{sellerName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabla de productos */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-1 bg-cyan-500 rounded-full" />
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Productos</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-cyan-200 to-transparent" />
          </div>

          <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <th className="text-left py-4 px-5 text-xs font-bold text-gray-600 uppercase tracking-wider w-20">Cant.</th>
                  <th className="text-left py-4 px-5 text-xs font-bold text-gray-600 uppercase tracking-wider">Descripción</th>
                  <th className="text-right py-4 px-5 text-xs font-bold text-gray-600 uppercase tracking-wider w-32">P. Unit.</th>
                  <th className="text-right py-4 px-5 text-xs font-bold text-gray-600 uppercase tracking-wider w-32">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-4 px-5">
                      <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white font-bold text-sm shadow-sm">
                        {item.quantity}
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <p className="font-semibold text-gray-900">{item.name}</p>
                    </td>
                    <td className="py-4 px-5 text-right text-gray-600 font-medium">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="py-4 px-5 text-right font-bold text-gray-900">
                      {formatCurrency(item.price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total */}
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-5">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold text-lg uppercase tracking-wide">Total</span>
                <span className="text-3xl font-bold text-white">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Observaciones */}
        {notes && (
          <div className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 mb-8">
            <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <div className="h-2 w-2 bg-amber-500 rounded-full" />
              Observaciones
            </h3>
            <p className="text-amber-900 font-medium">{notes}</p>
          </div>
        )}

        {/* Firmas */}
        <div className="grid grid-cols-2 gap-8 mt-16 mb-8">
          <div className="text-center">
            <div className="h-20 border-b-2 border-gray-300 mb-3" />
            <p className="font-semibold text-gray-700">Firma del Remitente</p>
            <p className="text-xs text-gray-500 mt-1">Helados Mío</p>
          </div>
          <div className="text-center">
            <div className="h-20 border-b-2 border-gray-300 mb-3" />
            <p className="font-semibold text-gray-700">Firma y Aclaración</p>
            <p className="text-xs text-gray-500 mt-1">Receptor - DNI</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-200 pt-6 text-center">
          <p className="text-xs text-gray-500 mb-1">Este documento no es válido como factura fiscal</p>
          <p className="text-xs text-gray-400">ID Venta: {saleId.toUpperCase()}</p>
          <p className="text-xs text-gray-400 mt-2">
            Generado: {formatDate(new Date())} {formatTime(new Date())}
          </p>
        </div>
      </div>
    )
  }
)

RemitoDocument.displayName = 'RemitoDocument'