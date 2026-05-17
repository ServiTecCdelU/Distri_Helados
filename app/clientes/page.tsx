'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getCached, setCache, invalidateCache } from '@/lib/query-cache'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableSkeleton } from '@/components/ui/data-table-skeleton'
import { ClientModal } from '@/components/clientes/client-modal'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { clientsApi } from '@/lib/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Client, Transaction } from '@/lib/types'
import { formatDate } from '@/lib/utils/format'
import { formatCurrency, normalizeCuit } from '@/lib/utils/format'
import {
  Plus,
  Search,
  Pencil,
  Eye,
  EyeOff,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  Users,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Minus,
  StickyNote,
  X,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
// no router needed — usaremos modal para pagos
import { supabase } from '@/lib/supabase'

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearchQuery(value), 400)
  }

  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [debtFilter, setDebtFilter] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showNotes, setShowNotes] = useState(false)

  // Paginación
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  // Consulta ARCA
  const [arcaDialogOpen, setArcaDialogOpen] = useState(false)
  const [arcaCuit, setArcaCuit] = useState('')
  const [arcaLoading, setArcaLoading] = useState(false)
  const [arcaDefaults, setArcaDefaults] = useState<Record<string, string> | null>(null)

  // Pago / actualización de deuda
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentClient, setPaymentClient] = useState<Client | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [paymentType, setPaymentType] = useState<'payment'|'debt'>('payment')
  const [paymentDescription, setPaymentDescription] = useState<string>('')
  const [paymentHistory, setPaymentHistory] = useState<Transaction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const handleConsultarArca = async () => {
    const cuitLimpio = normalizeCuit(arcaCuit)
    if (cuitLimpio.length !== 11) {
      toast.error('Ingresá un CUIT/CUIL válido de 11 dígitos')
      return
    }
    setArcaLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No autenticado')
      const token = session.access_token
      const res = await fetch(`/api/afip/cuit?cuit=${cuitLimpio}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error consultando ARCA')
        return
      }
      // Cerrar dialog ARCA y abrir modal de cliente pre-llenado
      setArcaDefaults({ name: data.nombre || '', address: data.domicilio || '', taxCategory: data.categoriaFiscal || 'consumidor_final', cuit: arcaCuit })
      setArcaDialogOpen(false)
      setArcaCuit('')
      setEditingClient(null)
      setModalOpen(true)
      toast.success(`Datos cargados desde ARCA${data.estadoClave ? ` — ${data.estadoClave}` : ''}`)
    } catch (e: any) {
      toast.error(e.message || 'Error consultando ARCA')
    } finally {
      setArcaLoading(false)
    }
  }

  const fetchClients = useCallback(async (skipCache = false) => {
    const cacheKey = `clientes:${pageSize}:${currentPage}:${searchQuery}:${categoryFilter}:${debtFilter}`
    if (!skipCache) {
      const cached = getCached<{ data: any[]; count: number }>(cacheKey)
      if (cached) {
        setClients(cached.data)
        setTotalCount(cached.count)
        setLoading(false)
        return
      }
    }
    setLoading(true)
    try {
      const result = await clientsApi.getPaginated(pageSize, currentPage - 1, {
        search: searchQuery || undefined,
        taxCategory: categoryFilter !== 'all' ? categoryFilter : undefined,
        hasDebt: debtFilter !== 'all' ? (debtFilter as 'with' | 'without') : undefined,
      })
      setClients(result.data)
      setTotalCount(result.count)
      setCache(cacheKey, { data: result.data, count: result.count })
    } catch {
      toast.error('Error al cargar los clientes')
    } finally {
      setLoading(false)
    }
  }, [pageSize, currentPage, searchQuery, categoryFilter, debtFilter])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const loadClients = async () => {
    await fetchClients()
  }

  const handleCreate = () => {
    setEditingClient(null)
    setModalOpen(true)
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setModalOpen(true)
  }

  const handleViewDetail = (client: Client) => {
    setSelectedClient(client)
    setShowNotes(false)
    setDetailModalOpen(true)
  }

  const handleSave = async (clientData: Omit<Client, 'id' | 'createdAt' | 'currentBalance'>) => {
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, clientData)
        toast.success('Cliente actualizado correctamente')
      } else {
        await clientsApi.create(clientData)
        toast.success('Cliente creado correctamente')
      }
      setModalOpen(false)
      invalidateCache('clientes')
      await fetchClients(true)
    } catch (error) {
      // Error silenciado
      toast.error('Error al guardar el cliente')
    }
  }

  const handleRegisterPayment = async () => {
    if (!paymentClient) return
    const amount = Number(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingresá un monto válido mayor a 0')
      return
    }
    try {
      setPaymentProcessing(true)
      if (paymentType === 'payment') {
        // Registrar pago via payments API
        await fetch('/api/register-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: paymentClient.id, amount, description: paymentDescription })
        })
        toast.success('Pago registrado correctamente')
      } else {
        // Sumar deuda (registro de tipo 'debt' en transacciones)
        await fetch('/api/register-debt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: paymentClient.id, amount, description: paymentDescription })
        })
        toast.success('Deuda registrada correctamente')
      }
      setPaymentDialogOpen(false)
      invalidateCache('clientes')
      await fetchClients(true)
      await loadPaymentHistory(paymentClient.id)
    } catch (e: any) {
      toast.error(e?.message || 'Error registrando el pago')
    } finally {
      setPaymentProcessing(false)
      // recargar historial
    }
  }

  const loadPaymentHistory = async (clientId: string) => {
    try {
      setHistoryLoading(true)
      const res = await fetch(`/api/public/clientes/${clientId}/transactions`)
      if (!res.ok) {
        setPaymentHistory([])
        return
      }
      const data = await res.json()
      setPaymentHistory(data)
    } catch {
      setPaymentHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  // Los clientes ya vienen filtrados y paginados del server
  const pagedClients = clients
  const totalPages = Math.ceil(totalCount / pageSize)

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1) }, [searchQuery, categoryFilter, debtFilter])

  const formatTaxCategory = (category: Client['taxCategory']) => {
    switch (category) {
      case 'responsable_inscripto':
        return 'Resp. Inscripto'
      case 'monotributo':
        return 'Monotributo'
      case 'consumidor_final':
        return 'Cons. Final'
      case 'exento':
        return 'Exento'
      case 'no_responsable':
        return 'No Responsable'
      default:
        return 'Cons. Final'
    }
  }

  const getCategoryColor = (category: Client['taxCategory']) => {
    switch (category) {
      case 'responsable_inscripto':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
      case 'monotributo':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
      case 'consumidor_final':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
      case 'exento':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
      case 'no_responsable':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
    }
  }

  const getDebtIndicator = (balance: number | undefined | null, limit: number | undefined | null) => {
    const safeBalance = balance ?? 0
    const safeLimit = limit ?? 0
    if (safeBalance === 0) {
      return { 
        color: 'text-emerald-600 dark:text-emerald-400', 
        bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        icon: Minus,
        label: 'Sin deuda' 
      }
    }
    const ratio = safeLimit > 0 ? safeBalance / safeLimit : 1
    if (ratio < 0.5) {
      return { 
        color: 'text-amber-600 dark:text-amber-400', 
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
        borderColor: 'border-amber-200 dark:border-amber-800',
        icon: TrendingUp,
        label: 'Deuda moderada' 
      }
    }
    return { 
      color: 'text-red-600 dark:text-red-400', 
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      icon: TrendingDown,
      label: 'Deuda alta' 
    }
  }

  // Stats
  const totalClients = totalCount
  const totalDebt = clients.reduce((sum, c) => sum + (c.currentBalance || 0), 0)
  const clientsWithDebt = clients.filter(c => c.currentBalance > 0).length

  return (
    <MainLayout title="Clientes" description="Gestiona tus clientes y sus cuentas corrientes">
      {/* Stats Cards - Solo visible en desktop */}
      <div className="hidden lg:grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Clientes</p>
                <p className="text-2xl font-bold text-foreground">{totalClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deuda Total</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalDebt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-500/5 to-rose-500/10 border-rose-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <TrendingUp className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Con Deuda</p>
                <p className="text-2xl font-bold text-foreground">{clientsWithDebt} <span className="text-sm font-normal text-muted-foreground">clientes</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header Actions - Desktop */}
      <div className="hidden md:flex flex-row gap-4 justify-between mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, DNI o CUIT..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>
          <div className="flex flex-row gap-3">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Todas las categorias</option>
              <option value="responsable_inscripto">Responsable Inscripto</option>
              <option value="monotributo">Monotributo</option>
              <option value="consumidor_final">Consumidor Final</option>
              <option value="exento">Exento</option>
              <option value="no_responsable">No Responsable</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={debtFilter}
              onChange={(e) => setDebtFilter(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="with">Con deuda</option>
              <option value="without">Sin deuda</option>
            </select>
          {/* <Button variant="outline" onClick={() => setArcaDialogOpen(true)} className="gap-2">
            <Search className="h-4 w-4" />
            Consultar ARCA
          </Button> */}
          <Button onClick={handleCreate} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Header Actions - Mobile */}
      <div className="flex md:hidden flex-col gap-3 mb-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Todas las categorias</option>
          <option value="responsable_inscripto">Responsable Inscripto</option>
          <option value="monotributo">Monotributo</option>
          <option value="consumidor_final">Consumidor Final</option>
          <option value="exento">Exento</option>
          <option value="no_responsable">No Responsable</option>
        </select>
      </div>

      {/* Loading State */}
      {loading ? (
        <>
          <div className="hidden md:block">
            <DataTableSkeleton columns={7} rows={5} />
          </div>
          <div className="md:hidden space-y-3 pb-20">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Empty State */}
          {totalCount === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Users className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">No se encontraron clientes</h3>
                <p className="text-muted-foreground text-sm text-center mb-6 max-w-sm">
                  {searchQuery || categoryFilter !== 'all'
                    ? 'Intenta ajustar los filtros de busqueda para encontrar lo que buscas'
                    : 'Comienza agregando tu primer cliente para gestionar sus cuentas corrientes'}
                </p>
                {!searchQuery && categoryFilter === 'all' && (
                  <Button onClick={handleCreate} className="gap-2" size="lg">
                    <Plus className="h-5 w-5" />
                    Agregar Primer Cliente
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Cliente</th>
                        <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">CUIT</th>
                        <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Categoría</th>
                        <th className="text-left px-3 py-1.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Contacto</th>
                        <th className="text-right px-3 py-1.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Límite</th>
                        <th className="text-right px-3 py-1.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Saldo</th>
                        <th className="text-center px-3 py-1.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pagedClients.map((client) => {
                        const debt = getDebtIndicator(client.currentBalance || 0, client.creditLimit || 0)
                        const DebtIcon = debt.icon
                        return (
                          <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-medium text-foreground truncate">{client.name}</span>
                                {client.notes && <StickyNote className="h-3 w-3 text-amber-500 shrink-0" />}
                              </div>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="font-mono text-[11px] text-muted-foreground">{client.cuit || '-'}</span>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${getCategoryColor(client.taxCategory)}`}>
                                {formatTaxCategory(client.taxCategory)}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="text-[11px] text-muted-foreground truncate block max-w-[160px]">
                                {client.phone || client.email || '-'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <span className="text-xs text-foreground">{formatCurrency(client.creditLimit || 0)}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <span className={`text-xs font-semibold ${debt.color}`}>{formatCurrency(client.currentBalance || 0)}</span>
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex justify-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewDetail(client)} title="Ver detalle">
                                  <Eye className="h-3 w-3" />
                                </Button>
                                {(client.currentBalance || 0) > 0 && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600" onClick={() => { setPaymentClient(client); setPaymentAmount(''); setPaymentType('payment'); setPaymentDescription(''); setPaymentDialogOpen(true) }} title="Registrar pago">
                                    <CreditCard className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(client)} title="Editar">
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 pb-24">
                {pagedClients.map((client) => {
                  const debt = getDebtIndicator(client.currentBalance || 0, client.creditLimit || 0)
                  const DebtIcon = debt.icon
const usagePercent = (client.creditLimit || 0) > 0
? Math.min(((client.currentBalance || 0) / (client.creditLimit || 1)) * 100, 100)
                    : 0

                  return (
                    <Card key={client.id} className="overflow-hidden border-border/60 shadow-sm active:scale-[0.99] transition-transform">
                      <CardContent className="p-0">
                        {/* Card Header */}
                        <div className="p-4 border-b border-border/50 bg-muted/30">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-lg font-semibold text-primary">
                                  {client.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-foreground truncate text-base">{client.name}</h3>
                                  {client.notes && (
                                    <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground font-mono">{client.cuit || 'Sin CUIT'}</p>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 -mr-2">
                                  <MoreVertical className="h-5 w-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleViewDetail(client)} className="flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(client)} className="flex items-center gap-2">
                                  <Pencil className="h-4 w-4" />
                                  Editar cliente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="mt-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(client.taxCategory)}`}>
                              <Building2 className="h-3 w-3 mr-1" />
                              {formatTaxCategory(client.taxCategory)}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 space-y-4">
                          {/* Contact Info */}
                          {(client.phone || client.email || client.address) && (
                            <div className="flex flex-col gap-2 text-sm">
                              {client.phone && (
                                <a 
                                  href={`tel:${client.phone}`} 
                                  className="flex items-center gap-2.5 text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                                    <Phone className="h-3.5 w-3.5" />
                                  </div>
                                  {client.phone}
                                </a>
                              )}
                              {client.email && (
                                <a 
                                  href={`mailto:${client.email}`} 
                                  className="flex items-center gap-2.5 text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                                    <Mail className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="truncate">{client.email}</span>
                                </a>
                              )}
                              {client.address && (
                                <div className="flex items-center gap-2.5 text-muted-foreground">
                                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                                    <MapPin className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="truncate">{client.address}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Credit Info */}
                          <div className={`rounded-xl p-4 ${debt.bgColor} border ${debt.borderColor}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saldo Deuda</p>
                                <div className={`flex items-center gap-2 ${debt.color}`}>
                                  <DebtIcon className="h-5 w-5" />
                                  <p className="font-bold text-2xl">
                                    {formatCurrency(client.currentBalance || 0)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Limite</p>
                                <p className="font-semibold text-lg text-foreground">
                                  {formatCurrency(client.creditLimit || 0)}
                                </p>
                              </div>
                            </div>
                            
                            {/* Progress Bar */}
                            {(client.creditLimit || 0) > 0 && (
                              <div className="space-y-1.5">
                                <div className="h-2 bg-background/50 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      client.currentBalance === 0
                                        ? 'bg-emerald-500'
                                        : usagePercent < 50
                                        ? 'bg-amber-500'
                                        : 'bg-red-500'
                                    }`}
                                    style={{ width: `${usagePercent}%` }}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground text-right">
                                  {Math.round(usagePercent)}% del limite utilizado
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex gap-2 pt-1">
                            <Button 
                              variant="outline" 
                              className="flex-1 h-10 bg-transparent"
                              onClick={() => handleEdit(client)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                            <Button 
                              className="flex-1 h-10"
                              onClick={() => handleViewDetail(client)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalle
                            </Button>
                            { (client.currentBalance || 0) > 0 && (
                              <Button
                                variant="outline"
                                className="h-10"
                                onClick={() => { setPaymentClient(client); setPaymentAmount(''); setPaymentDialogOpen(true) }}
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Pago la deuda
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              {/* Pagination controls */}
              {totalCount > pageSize && (
                <div className="flex items-center justify-between px-2 pb-6 md:pb-0 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} de {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[10, 20, 50, 100].map(n => <SelectItem key={n} value={String(n)} className="text-xs">{n} por página</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Anterior</Button>
                    <span className="text-sm text-muted-foreground">{currentPage}/{totalPages}</span>
                    <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Siguiente</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* FAB for Mobile */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleCreate}
          className="h-14 w-14 rounded-full shadow-lg shadow-primary/25"
          size="icon"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Nuevo Cliente</span>
        </Button>
      </div>

      {/* Client Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedClient && (
                <>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{selectedClient.name}</p>
                    <p className="text-sm font-normal text-muted-foreground">{selectedClient.cuit}</p>
                  </div>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedClient && (
            <div className="space-y-4 pt-2">
              {/* Category Badge */}
              <div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(selectedClient.taxCategory)}`}>
                  <Building2 className="h-3 w-3 mr-1" />
                  {formatTaxCategory(selectedClient.taxCategory)}
                </span>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                {selectedClient.phone && (
                  <a 
                    href={`tel:${selectedClient.phone}`}
                    className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedClient.phone}</span>
                  </a>
                )}
                {selectedClient.email && (
                  <a 
                    href={`mailto:${selectedClient.email}`}
                    className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{selectedClient.email}</span>
                  </a>
                )}
                {selectedClient.address && (
                  <div className="flex items-center gap-3 text-sm p-2 rounded-lg text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{selectedClient.address}</span>
                  </div>
                )}
              </div>

              {/* Credit Info */}
              {(() => {
                const debt = getDebtIndicator(selectedClient.currentBalance || 0, selectedClient.creditLimit || 0)
                const DebtIcon = debt.icon
                const usagePercent = selectedClient.creditLimit > 0 
                  ? Math.min((selectedClient.currentBalance / selectedClient.creditLimit) * 100, 100) 
                  : 0
                return (
                  <div className={`rounded-xl p-4 ${debt.bgColor} border ${debt.borderColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo Deuda</p>
                        <div className={`flex items-center gap-1.5 ${debt.color}`}>
                          <DebtIcon className="h-4 w-4" />
                          <p className="font-bold text-xl">{formatCurrency(selectedClient.currentBalance || 0)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Limite</p>
                        <p className="font-semibold text-foreground">{formatCurrency(selectedClient.creditLimit || 0)}</p>
                      </div>
                    </div>
                    {selectedClient.creditLimit > 0 && (
                      <div className="h-1.5 bg-background/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            selectedClient.currentBalance === 0
                              ? 'bg-emerald-500'
                              : usagePercent < 50
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Private Notes */}
              {selectedClient.notes && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowNotes(!showNotes)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <StickyNote className="h-4 w-4 text-amber-500" />
                      Observaciones Privadas
                    </div>
                    {showNotes ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {showNotes && (
                    <div className="px-3 pb-3">
                      <p className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                        {selectedClient.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 bg-transparent"
                  onClick={() => {
                    setDetailModalOpen(false)
                    handleEdit(selectedClient)
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => setDetailModalOpen(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      {/* Payment modal: permite registrar pago o agregar deuda (pago parcial/total o sumar crédito) */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {paymentClient ? `${paymentType === 'payment' ? 'Registrar pago' : 'Registrar deuda'} — ${paymentClient.name}` : (paymentType === 'payment' ? 'Registrar pago' : 'Registrar deuda')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Seleccioná acción, ingresá el monto y una descripción opcional.</p>
            <div className="flex gap-2">
              <button
                className={`flex-1 h-9 rounded-md border ${paymentType === 'payment' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-input'}`}
                onClick={() => setPaymentType('payment')}
              >Pago</button>
              <button
                className={`flex-1 h-9 rounded-md border ${paymentType === 'debt' ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-input'}`}
                onClick={() => setPaymentType('debt')}
              >Sumar deuda</button>
            </div>
            <div className="space-y-2">
              <Input
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegisterPayment()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Descripción (opcional)"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
              />
            </div>
            {/* Historial de deuda (fila horizontal) */}
            {paymentClient && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">Historial reciente</p>
                <div className="flex gap-2 overflow-x-auto">
                  {historyLoading ? (
                    <div className="text-sm text-muted-foreground">Cargando...</div>
                  ) : (
                    (paymentHistory.length === 0) ? (
                      <div className="text-sm text-muted-foreground">Sin movimientos</div>
                    ) : (
                      paymentHistory.slice(0,8).map((t) => (
                        <div key={t.id} className={`flex-shrink-0 px-3 py-2 rounded-lg border ${t.type === 'payment' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-8 rounded-md bg-white/50 flex items-center justify-center">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="text-xs text-muted-foreground">{formatDate(t.date)}</div>
                          </div>
                          <div className="text-sm font-medium">{t.type === 'payment' ? 'Pago' : 'Deuda'}</div>
                          <div className="text-sm">{formatCurrency(t.amount)}</div>
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleRegisterPayment} disabled={paymentProcessing || !paymentClient} className="gap-2">
                {paymentProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {paymentType === 'payment' ? 'Registrar pago' : 'Registrar deuda'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Modal (Create/Edit) */}
      <ClientModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setArcaDefaults(null) }}
        client={editingClient}
        onSave={handleSave}
        defaultValues={arcaDefaults ?? undefined}
      />

      {/* Dialog Consultar ARCA */}
      <Dialog open={arcaDialogOpen} onOpenChange={(open) => { setArcaDialogOpen(open); if (!open) setArcaCuit('') }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Consultar en ARCA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Ingresá el CUIT o CUIL para buscar los datos fiscales del contribuyente.
            </p>
            <div className="space-y-2">
              <Input
                placeholder="20-12345678-9"
                value={arcaCuit}
                onChange={(e) => setArcaCuit(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConsultarArca()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setArcaDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleConsultarArca} disabled={arcaLoading} className="gap-2">
                {arcaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </MainLayout>
  )
}
