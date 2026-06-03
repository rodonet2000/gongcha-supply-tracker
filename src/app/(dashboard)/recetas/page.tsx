export const dynamic = 'force-dynamic'
import { getMenuItems, getModifierRequirements, getKnownModifiers } from '@/features/recipes/actions/recipe-actions'
import { getSupplies } from '@/features/supplies/actions/supply-actions'
import { RecipesManager } from '@/features/recipes/components/recipes-manager'

export default async function RecetasPage() {
  let menuItems: Awaited<ReturnType<typeof getMenuItems>> = []
  let supplies: Awaited<ReturnType<typeof getSupplies>> = []
  let modifierReqs: Awaited<ReturnType<typeof getModifierRequirements>> = []
  let knownModifiers: string[] = []
  try {
    ;[menuItems, supplies, modifierReqs, knownModifiers] = await Promise.all([
      getMenuItems(), getSupplies(), getModifierRequirements(), getKnownModifiers(),
    ])
  } catch { /* schema not ready */ }

  return (
    <RecipesManager
      menuItems={menuItems}
      supplies={supplies}
      modifierRequirements={modifierReqs}
      knownModifiers={knownModifiers}
    />
  )
}
