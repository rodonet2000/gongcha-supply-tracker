import { chromium, Browser, Page } from 'playwright'
import { createServerClient } from '@/shared/lib/supabase/server'
import type { ScrapeProgressEvent } from '@/shared/types'
import { format, addDays } from 'date-fns'
import { calculateAndInsertAutoExits } from '@/features/scraper/actions/scrape-actions'

type ProgressCallback = (event: ScrapeProgressEvent) => void

interface ScrapedOrder {
  externalId: string
  posOrderId: string | null
  sessionExternalId: string | null
  orderTimestamp: string | null
  orderType: string | null
  channel: string | null
  paymentMethod: string | null
  customerName: string | null
  entryCode: string | null
  orderStatus: string | null
  subtotal: number | null
  tax: number | null
  discount: number | null
  serviceCharge: number | null
  tip: number | null
  deliveryFee: number | null
  total: number | null
  items: ScrapedOrderItem[]
}

interface ScrapedOrderItem {
  itemName: string
  instructions: string | null
  quantity: number
  unitPrice: number | null
  tax: number | null
  total: number | null
  modifiers: Array<{ name: string; quantity: number }>
}

export class FoodbotScraper {
  private browser: Browser | null = null
  private page: Page | null = null

  async scrape(
    weekStart: string,
    weekEnd: string,
    sessionId: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    const supabase = createServerClient()

    try {
      await supabase
        .from('scraping_sessions')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', sessionId)

      onProgress({ type: 'started', sessionId, message: 'Iniciando navegador...' })

      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
      this.page = await this.browser.newPage()
      this.page.setDefaultTimeout(30000)

      // Login
      onProgress({ type: 'progress', current: 0, total: 100, message: 'Iniciando sesión en Foodbot.ai...' })
      await this.login()

      // Navegar a historial
      onProgress({ type: 'progress', current: 5, total: 100, message: 'Navegando al historial de pedidos...' })
      await this.navigateToHistory()

      // Configurar filtro de fechas
      onProgress({ type: 'progress', current: 10, total: 100, message: `Filtrando semana ${weekStart} → ${weekEnd}...` })
      await this.setDateRange(weekStart, weekEnd)

      // Extraer lista de IDs
      onProgress({ type: 'progress', current: 15, total: 100, message: 'Extrayendo lista de pedidos...' })
      const orderIds = await this.extractOrderIds()

      onProgress({ type: 'progress', current: 20, total: orderIds.length, message: `${orderIds.length} pedidos encontrados. Extrayendo detalles...` })

      await supabase
        .from('scraping_sessions')
        .update({ orders_total: orderIds.length })
        .eq('id', sessionId)

      // Extraer detalles de cada pedido
      let processed = 0
      for (const orderId of orderIds) {
        try {
          // Verificar si ya existe (deduplicación)
          const { data: existing } = await supabase
            .from('orders')
            .select('id')
            .eq('external_id', orderId)
            .single()

          if (existing) {
            onProgress({ type: 'duplicate', external_id: orderId })
            processed++
            continue
          }

          const order = await this.extractOrderDetail(orderId, weekStart)
          await this.saveOrder(order, sessionId, weekStart)

          processed++
          onProgress({ type: 'order_saved', orderId: order.externalId, external_id: orderId })
          onProgress({
            type: 'progress',
            current: processed,
            total: orderIds.length,
            message: `Procesado ${processed}/${orderIds.length}: ${orderId}`,
          })

          await supabase
            .from('scraping_sessions')
            .update({ orders_processed: processed })
            .eq('id', sessionId)

          // Pausa breve para no sobrecargar el servidor
          await this.page!.waitForTimeout(500)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          onProgress({
            type: 'progress',
            current: processed,
            total: orderIds.length,
            message: `Error en pedido ${orderId}: ${msg}`,
          })
          processed++
        }
      }

      await supabase
        .from('scraping_sessions')
        .update({
          status: 'completed',
          orders_processed: processed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      // Auto-calculate stock exits from completed scraping session
      try {
        const branchResult = await supabase
          .from('branches')
          .select('id')
          .eq('active', true)
          .limit(1)
          .single()
        if (branchResult.data) {
          await calculateAndInsertAutoExits(
            sessionId,
            weekStart,
            branchResult.data.id,
            '00000000-0000-0000-0000-000000000000'
          )
        }
      } catch (err) {
        console.error('[auto-exits] Error calculating stock exits:', err)
      }

      onProgress({ type: 'completed', ordersCount: processed, sessionId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await supabase
        .from('scraping_sessions')
        .update({ status: 'error', error_message: msg })
        .eq('id', sessionId)
      onProgress({ type: 'error', message: msg })
      throw err
    } finally {
      await this.browser?.close()
    }
  }

  private async login(): Promise<void> {
    const page = this.page!
    await page.goto(process.env.FOODBOT_URL + '/login', { waitUntil: 'networkidle' })

    // Buscar botón "Entrar con usuario y contraseña"
    const loginBtn = page.locator('text=Entrar con usuario y contraseña, text=Login with email, button:has-text("contraseña")').first()
    const btnExists = await loginBtn.count()
    if (btnExists > 0) {
      await loginBtn.click()
      await page.waitForTimeout(500)
    }

    // Llenar email
    await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="usuario" i]')
      .first()
      .fill(process.env.FOODBOT_EMAIL!)

    // Llenar password
    await page.locator('input[type="password"], input[name="password"]')
      .first()
      .fill(process.env.FOODBOT_PASSWORD!)

    // Submit
    await page.locator('button[type="submit"]:has-text("Login"), button:has-text("Entrar"), button:has-text("Iniciar")').first().click()

    // Esperar navegación post-login
    await page.waitForURL(/dashboard|orders|pedidos|tablero/, { timeout: 15000 })
  }

  private async navigateToHistory(): Promise<void> {
    const page = this.page!

    // Buscar "Pedidos en línea" en el menú lateral
    const pedidosLink = page.locator('text=Pedidos en línea, text=Online Orders, a:has-text("Pedidos")').first()
    if (await pedidosLink.count() > 0) {
      await pedidosLink.click()
      await page.waitForTimeout(800)
    }

    // Buscar "Historial de pedidos"
    const historialLink = page.locator('text=Historial de pedidos, text=Order History, a:has-text("Historial")').first()
    if (await historialLink.count() > 0) {
      await historialLink.click()
    } else {
      // Intentar navegación directa
      await page.goto(`${process.env.FOODBOT_URL}/orders/history`, { waitUntil: 'networkidle' })
    }

    await page.waitForTimeout(1500)
  }

  private async setDateRange(weekStart: string, weekEnd: string): Promise<void> {
    const page = this.page!

    // El formato de Foodbot es DD/Mon/YYYY
    const startDate = new Date(weekStart + 'T00:00:00')
    const endDate = new Date(weekEnd + 'T23:59:59')
    const startFmt = format(startDate, 'dd/MMM/yyyy').replace(/\//g, '/')
    const endFmt = format(endDate, 'dd/MMM/yyyy').replace(/\//g, '/')

    // Buscar el picker de fecha y hacer click
    const datePicker = page.locator('[class*="date-range"], [class*="DateRange"], [class*="date_range"], button:has-text("/202"), div:has-text("Mayo"), div:has-text("Junio")').first()

    if (await datePicker.count() > 0) {
      await datePicker.click()
      await page.waitForTimeout(500)
    }

    // Intentar limpiar y escribir directamente en los inputs de fecha
    const dateInputs = page.locator('input[type="text"][class*="date" i], input[placeholder*="fecha" i], input[placeholder*="date" i]')
    const inputCount = await dateInputs.count()

    if (inputCount >= 2) {
      await dateInputs.nth(0).click({ clickCount: 3 })
      await dateInputs.nth(0).fill(startFmt)
      await dateInputs.nth(1).click({ clickCount: 3 })
      await dateInputs.nth(1).fill(endFmt)
    } else if (inputCount === 1) {
      await dateInputs.first().click({ clickCount: 3 })
      await dateInputs.first().fill(`${startFmt} - ${endFmt}`)
    }

    // Presionar Enter o buscar botón de aplicar
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    // Buscar y hacer click en "Aplicar" o "Buscar"
    const applyBtn = page.locator('button:has-text("Aplicar"), button:has-text("Apply"), button:has-text("Buscar"), button:has-text("Search"), button:has-text("Filter")').first()
    if (await applyBtn.count() > 0) {
      await applyBtn.click()
    }

    await page.waitForTimeout(2000)
  }

  private async extractOrderIds(): Promise<string[]> {
    const page = this.page!
    const orderIds: string[] = []

    let hasNextPage = true
    while (hasNextPage) {
      await page.waitForTimeout(1000)

      // Extraer IDs de la tabla actual
      const links = await page.locator('a[href*="/orders/"], td a:has-text("#"), a:has-text("#25")').all()

      for (const link of links) {
        const text = await link.textContent()
        if (text) {
          // Extraer el número del pedido (ej: #255106739144 → 255106739144)
          const match = text.match(/#?(\d{10,15})/)
          if (match && !orderIds.includes(match[1])) {
            orderIds.push(match[1])
          }
        }
      }

      // Buscar paginación
      const nextBtn = page.locator('button:has-text("Siguiente"), button:has-text("Next"), a:has-text("Next"), [aria-label="Next page"], button[disabled]:has-text("Next")').first()
      if (await nextBtn.count() > 0) {
        const isDisabled = await nextBtn.isDisabled()
        if (!isDisabled) {
          await nextBtn.click()
          await page.waitForTimeout(1500)
        } else {
          hasNextPage = false
        }
      } else {
        hasNextPage = false
      }
    }

    return orderIds
  }

  private async extractOrderDetail(orderId: string, weekStart: string): Promise<ScrapedOrder> {
    const page = this.page!

    // Navegar al detalle del pedido
    const orderLink = page.locator(`a:has-text("#${orderId}"), a[href*="${orderId}"]`).first()
    if (await orderLink.count() > 0) {
      await orderLink.click()
    } else {
      await page.goto(`${process.env.FOODBOT_URL}/orders/${orderId}`, { waitUntil: 'networkidle' })
    }

    await page.waitForTimeout(1000)

    // Extraer datos del header
    const getFieldValue = async (labels: string[]): Promise<string | null> => {
      for (const label of labels) {
        const el = page.locator(`td:has-text("${label}") + td, dt:has-text("${label}") ~ dd, *:has-text("${label}:") span`).first()
        if (await el.count() > 0) {
          const text = await el.textContent()
          return text?.trim() ?? null
        }
        // Intento por texto adyacente
        const full = page.locator(`*:has-text("${label}:")`).first()
        if (await full.count() > 0) {
          const text = await full.textContent()
          const value = text?.replace(label + ':', '').trim()
          if (value) return value
        }
      }
      return null
    }

    const orderStatus = await getFieldValue(['Estatus del pedido', 'Order Status', 'Status'])
    const orderType = await getFieldValue(['Tipo de orden', 'Order Type'])
    const channel = await getFieldValue(['Canal', 'Channel'])
    const paymentMethod = await getFieldValue(['Modo de pago', 'Payment Mode', 'Método de pago'])
    const customerName = await getFieldValue(['Nombre del cliente', 'Customer Name'])
    const entryCode = await getFieldValue(['Código de entrada', 'Entry Code'])

    // Extraer timestamp
    let orderTimestamp: string | null = null
    const timestampEl = page.locator('*:has-text("Ordenado en"), *:has-text("Fecha y hora"), *:has-text("Order Time")').first()
    if (await timestampEl.count() > 0) {
      const txt = await timestampEl.textContent()
      const match = txt?.match(/(\d{2}[-/]\w{3}[-/]\d{4}\s+\d{2}:\d{2})/)
      if (match) orderTimestamp = match[1]
    }

    // Extraer items de la tabla "Detalles de artículo"
    const items = await this.extractOrderItems()

    // Extraer totales
    const parseAmount = async (label: string): Promise<number | null> => {
      const cells = page.locator(`tr:has-text("${label}") td, tr:has(td:has-text("${label}")) td`).last()
      if (await cells.count() > 0) {
        const txt = await cells.textContent()
        const match = txt?.match(/[\d,]+\.?\d*/)
        if (match) return parseFloat(match[0].replace(',', ''))
      }
      return null
    }

    const total = await parseAmount('Total')
    const discount = await parseAmount('Descuento')
    const serviceCharge = await parseAmount('Cargo por servicio')
    const tip = await parseAmount('propina')
    const deliveryFee = await parseAmount('envío')

    // Calcular subtotal estimado
    const itemsTotal = items.reduce((sum, item) => sum + (item.total ?? 0), 0)

    // Volver a la lista
    await page.goBack()
    await page.waitForTimeout(500)

    return {
      externalId: orderId,
      posOrderId: null,
      sessionExternalId: null,
      orderTimestamp,
      orderType,
      channel,
      paymentMethod,
      customerName,
      entryCode,
      orderStatus,
      subtotal: itemsTotal || null,
      tax: null,
      discount,
      serviceCharge,
      tip,
      deliveryFee,
      total,
      items,
    }
  }

  private async extractOrderItems(): Promise<ScrapedOrderItem[]> {
    const page = this.page!
    const items: ScrapedOrderItem[] = []

    // Buscar la sección "Detalles de artículo"
    const tableRows = await page.locator('table tbody tr, .order-items tr, [class*="item"] tr').all()

    let currentItem: ScrapedOrderItem | null = null

    for (const row of tableRows) {
      const cells = await row.locator('td').all()
      if (cells.length === 0) continue

      const firstCellText = (await cells[0].textContent())?.trim() ?? ''

      // Detectar si es un modificador (empieza con "1x", "2x", etc.)
      const isModifier = /^\d+x\s+.+/.test(firstCellText)

      if (isModifier && currentItem) {
        const match = firstCellText.match(/^(\d+)x\s+(.+)/)
        if (match) {
          currentItem.modifiers.push({
            name: match[2].trim(),
            quantity: parseInt(match[1]),
          })
        }
        continue
      }

      // Es un item principal
      if (firstCellText && !isModifier && cells.length >= 3) {
        if (currentItem) items.push(currentItem)

        const qty = parseInt((await cells[2]?.textContent())?.trim() ?? '1') || 1
        const unitPriceText = (await cells[3]?.textContent())?.trim()
        const taxText = (await cells[4]?.textContent())?.trim()
        const totalText = (await cells[5]?.textContent())?.trim()

        const parseNum = (txt?: string): number | null => {
          if (!txt) return null
          const match = txt.match(/[\d,]+\.?\d*/)
          if (!match) return null
          return parseFloat(match[0].replace(',', ''))
        }

        currentItem = {
          itemName: firstCellText,
          instructions: (await cells[1]?.textContent())?.trim() || null,
          quantity: qty,
          unitPrice: parseNum(unitPriceText),
          tax: parseNum(taxText),
          total: parseNum(totalText),
          modifiers: [],
        }
      }
    }

    if (currentItem) items.push(currentItem)
    return items
  }

  private async saveOrder(
    order: ScrapedOrder,
    sessionId: string,
    weekStart: string
  ): Promise<void> {
    const supabase = createServerClient()

    // Guardar pedido
    const { data: savedOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        external_id: order.externalId,
        pos_order_id: order.posOrderId,
        session_external_id: order.sessionExternalId,
        order_timestamp: order.orderTimestamp,
        brand: 'Gong Cha',
        order_type: order.orderType,
        channel: order.channel,
        payment_method: order.paymentMethod,
        customer_name: order.customerName,
        entry_code: order.entryCode,
        order_status: order.orderStatus,
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        service_charge: order.serviceCharge,
        tip: order.tip,
        delivery_fee: order.deliveryFee,
        total: order.total,
        week_start: weekStart,
        scraping_session_id: sessionId,
      })
      .select('id')
      .single()

    if (orderError || !savedOrder) {
      // Si es un duplicado (unique constraint), ignorar silenciosamente
      if (orderError?.code === '23505') return
      throw new Error(`Error guardando pedido ${order.externalId}: ${orderError?.message}`)
    }

    // Guardar items y sus modificadores
    for (const item of order.items) {
      const { data: savedItem, error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: savedOrder.id,
          item_name: item.itemName,
          instructions: item.instructions,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax: item.tax,
          total: item.total,
        })
        .select('id')
        .single()

      if (itemError || !savedItem) continue

      // Sincronizar menu_items catálogo
      await supabase
        .from('menu_items')
        .upsert({ name: item.itemName }, { onConflict: 'name', ignoreDuplicates: true })

      // Guardar modificadores
      if (item.modifiers.length > 0) {
        await supabase.from('order_item_modifiers').insert(
          item.modifiers.map((mod) => ({
            order_item_id: savedItem.id,
            modifier_name: mod.name,
            quantity: mod.quantity,
          }))
        )
      }
    }
  }
}
