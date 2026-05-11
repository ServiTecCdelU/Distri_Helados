'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { clientsApi, paymentsApi } from '@/lib/api'
import type { Client, Transaction } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { DollarSign, Plus, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDescription, setPaymentDescription] = useState('')
  const [processingPayment, setProcessingPayment] = useState(false)

  useEffect(() => {
    loadData()
  }, [params.id])

  const loadData = async () => {
    const clientId = params.id as string
    
    try {
      const clientData = await clientsApi.getById(clientId)
      
      if (!clientData) {
        setClient(null)
        setLoading(false)
        return
      }
      
      setClient(clientData)
      
      try {
        const transactionsData = await clientsApi.getTransactions(clientId)
        setTransactions(transactionsData)
      } catch {
        setTransactions([])
      }
    } catch {
      setClient(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!client) return

    setProcessingPayment(true)
    try {
      const newTransaction = await paymentsApi.registerCashPayment({
        clientId: client.id,
        amount: Number(paymentAmount),
        description: paymentDescription || 'Pago en efectivo',
      })
      
      setTransactions([newTransaction, ...transactions])
      setClient({
        ...client,
        currentBalance: client.currentBalance - Number(paymentAmount),
      })
      setPaymentModalOpen(false)
      setPaymentAmount('')
      setPaymentDescription('')
    } catch (error) {
      console.error('Error registering payment:', error)
    } finally {
      setProcessingPayment(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </MainLayout>
    )
  }

  if (!client) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cliente no encontrado</p>
          <Button onClick={() => router.push('/clientes')} className="mt-4">
            Volver a Clientes
          </Button>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      {/* Header */}
      <PageHeader
        backButton
        backHref="/clientes"
        description={
          <>
            <h1 className="text-2xl font-semibold text-foreground">{client.name}</h1>
            <p className="text-muted-foreground text-sm">{client.cuit}</p>
          </>
        }
        actions={
          <Button onClick={() => setPaymentModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Registrar Pago
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${client.currentBalance > 0 ? 'text-destructive' : 'text-success'}`}>
              {formatCurrency(client.currentBalance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Límite de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(client.creditLimit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Disponible: {formatCurrency(client.creditLimit - client.currentBalance)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contacto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{client.email}</p>
            <p className="text-sm text-muted-foreground">{client.phone}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Categoría Fiscal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {client.taxCategory === 'responsable_inscripto' && 'Resp. Inscripto'}
              {client.taxCategory === 'monotributo' && 'Monotributo'}
              {client.taxCategory === 'consumidor_final' && 'Consumidor Final'}
              {client.taxCategory === 'exento' && 'Exento'}
              {client.taxCategory === 'no_responsable' && 'No Responsable'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Cuenta Corriente</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay movimientos registrados
            </p>
          ) : (() => {
            // Ordenar cronológicamente (más antiguo primero) para calcular saldo corriente
            const sorted = [...transactions].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            )
            // Calcular running balance
            let balance = 0
            const withBalance = sorted.map((t) => {
              if (t.type === 'debt') balance += t.amount
              else balance -= t.amount
              return { ...t, runningBalance: balance }
            })
            // Mostrar newest-first
            const display = [...withBalance].reverse()

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descripción</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-destructive uppercase tracking-wider">Débito (+)</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-success uppercase tracking-wider">Crédito (-)</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {display.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="py-3 px-3 text-foreground">{t.description}</td>
                        <td className="py-3 px-3 text-right font-medium text-destructive">
                          {t.type === 'debt' ? formatCurrency(t.amount) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-success">
                          {t.type === 'payment' ? formatCurrency(t.amount) : '—'}
                        </td>
                        <td className={`py-3 px-3 text-right font-semibold ${t.runningBalance > 0 ? 'text-destructive' : 'text-success'}`}>
                          {formatCurrency(t.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegisterPayment} className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Saldo actual</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(client.currentBalance)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Monto del Pago (ARS)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                max={client.currentBalance}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Input
                id="description"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                placeholder="Pago en efectivo"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={processingPayment}>
                {processingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Pago
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}
