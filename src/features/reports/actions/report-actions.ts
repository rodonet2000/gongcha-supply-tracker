'use server'

import { createServerClient } from '@/shared/lib/supabase/server'
import type { SupplyRequirement } from '@/shared/types'

export async function calculateWeeklySupplyRequirements(weekStart: string): Promise<SupplyRequirement[]> {
  const supabase = createServerClient()

  // 1. Obtener todos los items vendidos en la semana
  const { data: items } = await supabase
    .from('order_items')
    .select(`
      id,
      item_name,
      quantity,
      modifiers:order_item_modifiers(modifier_name, quantity),
      order:orders!inner(week_start)
    `)
    .eq('order.week_start', weekStart)

  if (!items || items.length === 0) return []

  // 2. Obtener recetas base
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, supply:supplies(*), menu_item:menu_items(*)')

  // 3. Obtener requerimientos de modificadores
  const { data: modReqs } = await supabase
    .from('modifier_supply_requirements')
    .select('*, supply:supplies(*)')

  // 4. Calcular totales por insumo
  const supplyMap = new Map<string, SupplyRequirement>()

  const ensureSupply = (supply: { id: string; name: string; unit: string; category: string | null; cost_per_unit: number | null }) => {
    if (!supplyMap.has(supply.id)) {
      supplyMap.set(supply.id, {
        supply_id: supply.id,
        supply_name: supply.name,
        unit: supply.unit,
        category: supply.category,
        total_quantity: 0,
        estimated_cost: null,
        breakdown: [],
      })
    }
    return supplyMap.get(supply.id)!
  }

  const addToSupply = (
    supplyId: string,
    supply: { id: string; name: string; unit: string; category: string | null; cost_per_unit: number | null },
    qty: number,
    source: string,
    sourceCount: number
  ) => {
    const s = ensureSupply(supply)
    s.total_quantity += qty
    const existing = s.breakdown.find((b) => b.source === source)
    if (existing) {
      existing.quantity += qty
      existing.source_count += sourceCount
    } else {
      s.breakdown.push({ source, quantity: qty, source_count: sourceCount })
    }
  }

  for (const item of items) {
    const itemName = item.item_name
    const itemQty = item.quantity

    // Detectar tamaño del item a partir de los modificadores
    const sizeModifiers = (item.modifiers as Array<{ modifier_name: string; quantity: number }>)
      .map((m) => m.modifier_name)
      .filter((m) => /mediano|grande|pequeño|regular|large|medium|small/i.test(m))
    const size = sizeModifiers[0] ?? null

    // Aplicar receta base
    const itemRecipes = (recipes ?? []).filter(
      (r) =>
        r.menu_item?.name === itemName &&
        (r.size === null || r.size === size || (size === null && r.size === null))
    )

    for (const recipe of itemRecipes) {
      if (!recipe.supply) continue
      addToSupply(
        recipe.supply.id,
        recipe.supply,
        recipe.quantity * itemQty,
        itemName,
        itemQty
      )
    }

    // Aplicar requerimientos de modificadores
    for (const mod of (item.modifiers as Array<{ modifier_name: string; quantity: number }>)) {
      const modReqsForMod = (modReqs ?? []).filter((r) => r.modifier_name === mod.modifier_name)

      for (const req of modReqsForMod) {
        if (!req.supply) continue

        if (req.is_override) {
          // Reemplaza: primero encontrar el supply en el map y ajustar
          const existing = supplyMap.get(req.supply.id)
          if (existing) {
            const recipeEntry = existing.breakdown.find((b) => b.source === itemName)
            if (recipeEntry) {
              existing.total_quantity -= recipeEntry.quantity
              recipeEntry.quantity = req.quantity * itemQty * mod.quantity
              existing.total_quantity += recipeEntry.quantity
            }
          }
        } else {
          // Suma
          addToSupply(
            req.supply.id,
            req.supply,
            req.quantity * itemQty * mod.quantity,
            `${itemName} + ${mod.modifier_name}`,
            itemQty
          )
        }
      }
    }
  }

  // Calcular costo estimado
  const result = Array.from(supplyMap.values())
  for (const s of result) {
    const supply = (recipes ?? []).find((r) => r.supply?.id === s.supply_id)?.supply
    if (supply?.cost_per_unit) {
      s.estimated_cost = supply.cost_per_unit * s.total_quantity
    }
  }

  return result.sort((a, b) => {
    if (a.category && b.category) return a.category.localeCompare(b.category)
    return a.supply_name.localeCompare(b.supply_name)
  })
}
