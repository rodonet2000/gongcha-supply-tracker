'use client'

import { useState, useTransition } from 'react'
import { upsertModifierRequirement, deleteModifierRequirement, upsertRecipe, deleteRecipe, getRecipesByMenuItem } from '@/features/recipes/actions/recipe-actions'
import { Plus, Trash2, X, BookOpen, Settings2 } from 'lucide-react'
import type { MenuItem, Supply, ModifierSupplyRequirement, Recipe } from '@/shared/types'

interface Props {
  menuItems: MenuItem[]
  supplies: Supply[]
  modifierRequirements: ModifierSupplyRequirement[]
  knownModifiers: string[]
}

export function RecipesManager({ menuItems, supplies, modifierRequirements, knownModifiers }: Props) {
  const [tab, setTab] = useState<'modificadores' | 'recetas'>('modificadores')
  const [modReqs, setModReqs] = useState(modifierRequirements)
  const [showModForm, setShowModForm] = useState(false)
  const [selectedMenuItem, setSelectedMenuItem] = useState('')
  const [menuItemRecipes, setMenuItemRecipes] = useState<Recipe[]>([])
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const loadRecipes = (menuItemId: string) => {
    setSelectedMenuItem(menuItemId)
    startTransition(async () => {
      const recipes = await getRecipesByMenuItem(menuItemId)
      setMenuItemRecipes(recipes)
    })
  }

  const handleAddModifier = (formData: FormData) => {
    startTransition(async () => {
      const result = await upsertModifierRequirement({
        modifierName: formData.get('modifier_name') as string,
        supplyId: formData.get('supply_id') as string,
        quantity: parseFloat(formData.get('quantity') as string),
        isOverride: formData.get('is_override') === 'true',
        notes: formData.get('notes') as string || null,
      })
      if (result.success) {
        setShowModForm(false)
        window.location.reload()
      } else {
        setError(result.error ?? 'Error')
      }
    })
  }

  const handleDeleteMod = (id: string) => {
    startTransition(async () => {
      await deleteModifierRequirement(id)
      setModReqs((prev) => prev.filter((r) => r.id !== id))
    })
  }

  const handleAddRecipe = (formData: FormData) => {
    startTransition(async () => {
      const result = await upsertRecipe({
        menuItemId: selectedMenuItem,
        supplyId: formData.get('supply_id') as string,
        quantity: parseFloat(formData.get('quantity') as string),
        size: formData.get('size') as string || null,
        notes: formData.get('notes') as string || null,
      })
      if (result.success) {
        setShowRecipeForm(false)
        const recipes = await getRecipesByMenuItem(selectedMenuItem)
        setMenuItemRecipes(recipes)
      } else {
        setError(result.error ?? 'Error')
      }
    })
  }

  const handleDeleteRecipe = (id: string) => {
    startTransition(async () => {
      await deleteRecipe(id)
      setMenuItemRecipes((prev) => prev.filter((r) => r.id !== id))
    })
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Recetas & Modificadores</h1>
        <p className="text-slate-500 text-sm mt-1">
          Configura los insumos por producto y por modificador para calcular requerimientos semanales
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <TabBtn active={tab === 'modificadores'} onClick={() => setTab('modificadores')}>
          <Settings2 size={14} />
          Modificadores ({modReqs.length})
        </TabBtn>
        <TabBtn active={tab === 'recetas'} onClick={() => setTab('recetas')}>
          <BookOpen size={14} />
          Recetas por producto
        </TabBtn>
      </div>

      {tab === 'modificadores' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowModForm(true)}
              className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
            >
              <Plus size={15} />
              Agregar requerimiento
            </button>
          </div>

          {/* Modal */}
          {showModForm && (
            <Modal title="Insumo por modificador" onClose={() => setShowModForm(false)}>
              <form action={handleAddModifier} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Modificador *</label>
                  <input
                    name="modifier_name"
                    list="known-modifiers"
                    required
                    placeholder="Tapioca Blanca, Mediano, etc."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <datalist id="known-modifiers">
                    {knownModifiers.map((m) => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Insumo *</label>
                  <select name="supply_id" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Seleccionar...</option>
                    {supplies.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Cantidad *</label>
                    <input name="quantity" type="number" step="0.001" required placeholder="50" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo</label>
                    <select name="is_override" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                      <option value="false">Suma (adicional)</option>
                      <option value="true">Reemplaza cantidad base</option>
                    </select>
                  </div>
                </div>
                <FormActions onCancel={() => setShowModForm(false)} isPending={isPending} error={error} />
              </form>
            </Modal>
          )}

          {modReqs.length === 0 ? (
            <EmptyState msg="No hay requerimientos de modificadores. Agrégalos para que el reporte calcule los insumos por modificador." />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Modificador</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Insumo</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">Cantidad</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Tipo</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Notas</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {modReqs.map((req) => (
                    <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{req.modifier_name}</td>
                      <td className="px-5 py-3 text-slate-600">{(req.supply as Supply)?.name ?? '--'}</td>
                      <td className="px-5 py-3 text-right">
                        {req.quantity} <span className="text-slate-400">{(req.supply as Supply)?.unit}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${req.is_override ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                          {req.is_override ? 'Reemplaza' : 'Suma'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{req.notes ?? '--'}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleDeleteMod(req.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'recetas' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Lista de productos */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 h-fit">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Productos del menú</p>
            {menuItems.length === 0 ? (
              <p className="text-xs text-slate-400">Extrae pedidos primero para poblar el catálogo de productos.</p>
            ) : (
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadRecipes(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedMenuItem === item.id
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recetas del producto seleccionado */}
          <div className="col-span-2">
            {!selectedMenuItem ? (
              <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                <p className="text-slate-400 text-sm">Selecciona un producto para ver/editar su receta</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                  <p className="font-medium text-slate-800">
                    {menuItems.find((m) => m.id === selectedMenuItem)?.name}
                  </p>
                  <button onClick={() => setShowRecipeForm(true)} className="flex items-center gap-1.5 text-brand-600 text-sm hover:text-brand-700">
                    <Plus size={14} />
                    Agregar insumo
                  </button>
                </div>

                {showRecipeForm && (
                  <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <form action={handleAddRecipe} className="grid grid-cols-4 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Insumo</label>
                        <select name="supply_id" required className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                          <option value="">Seleccionar...</option>
                          {supplies.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad</label>
                        <input name="quantity" type="number" step="0.001" required placeholder="50" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Tamaño</label>
                        <select name="size" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                          <option value="">Todos</option>
                          <option value="Mediano">Mediano</option>
                          <option value="Grande">Grande</option>
                          <option value="Pequeño">Pequeño</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={isPending} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                          Guardar
                        </button>
                        <button type="button" onClick={() => setShowRecipeForm(false)} className="border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50">
                          <X size={14} />
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400">Insumo</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-400">Cantidad</th>
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400">Tamaño</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {menuItemRecipes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-xs">
                          Sin ingredientes configurados
                        </td>
                      </tr>
                    ) : (
                      menuItemRecipes.map((r) => (
                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-5 py-2.5 text-slate-800">{(r.supply as Supply)?.name ?? '--'}</td>
                          <td className="px-5 py-2.5 text-right text-slate-700">
                            {r.quantity} <span className="text-slate-400">{(r.supply as Supply)?.unit}</span>
                          </td>
                          <td className="px-5 py-2.5 text-slate-500">{r.size ?? 'Todos'}</td>
                          <td className="px-5 py-2.5">
                            <button onClick={() => handleDeleteRecipe(r.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormActions({ onCancel, isPending, error }: { onCancel: () => void; isPending: boolean; error: string }) {
  return (
    <>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
          {isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <p className="text-slate-400 text-sm">{msg}</p>
    </div>
  )
}
