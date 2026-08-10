"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { Link2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  addListItemAction,
  deleteListAction,
  removeListItemAction,
  reorderListItemsAction,
  setListVisibilityAction,
} from "@/actions/lists"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getPublicListUrl } from "@/lib/lists/getPublicListUrl"
import type { ListItemWithMedia, MediaSearchResult } from "@/services"
import type { UserList } from "@/types"
import { CreateListDialog } from "./CreateListDialog"
import { SortableListItemCard } from "./SortableListItemCard"
import { TitleSearchAndAdd } from "./TitleSearchAndAdd"

export function ListDetail({ list, items: initialItems }: { list: UserList; items: ListItemWithMedia[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [isPublic, setIsPublic] = useState(list.isPublic)
  const [removingMediaId, setRemovingMediaId] = useState<string | null>(null)
  const [, startVisibilityTransition] = useTransition()
  const [, startMutationTransition] = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()

  const publicUrl = getPublicListUrl({ ...list, isPublic })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleVisibilityChange(checked: boolean) {
    const previous = isPublic
    setIsPublic(checked)
    startVisibilityTransition(async () => {
      const result = await setListVisibilityAction(list.id, checked, list.slug)
      if (!result.success) {
        setIsPublic(previous)
        toast.error(result.error ?? "No se pudo actualizar la visibilidad.")
        return
      }
      toast.success(checked ? "La lista ahora es pública." : "La lista ahora es privada.")
    })
  }

  function handleCopyLink() {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    toast.success("Enlace copiado.")
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteListAction(list.id, list.slug)
      if (!result.success) {
        toast.error(result.error ?? "No se pudo eliminar la lista.")
        return
      }
      toast.success(`Se eliminó "${list.name}".`)
      router.push("/mis-listas")
    })
  }

  function handleRemove(item: ListItemWithMedia) {
    const previous = items
    setRemovingMediaId(item.mediaId)
    setItems((current) => current.filter((entry) => entry.mediaId !== item.mediaId))

    startMutationTransition(async () => {
      try {
        await removeListItemAction(list.id, item.mediaId, list.slug)
        toast.success(`Se quitó "${item.media.title}" de la lista.`)
      } catch (error) {
        setItems(previous)
        toast.error(error instanceof Error ? error.message : "No se pudo quitar el título.")
      } finally {
        setRemovingMediaId(null)
      }
    })
  }

  function handleAdd(result: MediaSearchResult) {
    if (items.some((entry) => entry.mediaId === result.id)) return

    const newItem: ListItemWithMedia = {
      id: `local-${result.id}`,
      mediaId: result.id,
      sortOrder: items.length,
      note: null,
      media: {
        id: result.id,
        slug: result.slug,
        title: result.title,
        year: result.year,
        posterUrl: result.posterUrl,
        imdbRating: result.imdbRating,
        isStub: result.isStub,
      },
    }

    setItems((current) => [...current, newItem])

    startMutationTransition(async () => {
      try {
        await addListItemAction(list.id, result.id, list.slug)
        toast.success(`Se agregó "${result.title}".`)
      } catch (error) {
        setItems((current) => current.filter((entry) => entry.mediaId !== result.id))
        toast.error(error instanceof Error ? error.message : "No se pudo agregar el título.")
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const previous = items
    const oldIndex = previous.findIndex((entry) => entry.mediaId === active.id)
    const newIndex = previous.findIndex((entry) => entry.mediaId === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(previous, oldIndex, newIndex)
    setItems(reordered)

    startMutationTransition(async () => {
      try {
        await reorderListItemsAction(
          list.id,
          reordered.map((entry) => entry.mediaId),
          list.slug
        )
      } catch (error) {
        setItems(previous)
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el nuevo orden.")
      }
    })
  }

  const existingMediaIds = new Set(items.map((entry) => entry.mediaId))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <Link href="/mis-listas" className="text-xs text-muted-foreground hover:text-foreground">
        ← Volver a mis listas
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-medium">{list.name}</h1>
          {list.description && <p className="text-sm text-muted-foreground">{list.description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CreateListDialog list={list} trigger={<Button variant="outline">Editar</Button>} />

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="destructive">
                  <Trash2 /> Eliminar
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar &quot;{list.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminarán todos los títulos guardados en esta lista.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={deletePending} onClick={handleDelete}>
                  {deletePending ? "Eliminando..." : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border border-border p-3">
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={isPublic} onCheckedChange={handleVisibilityChange} />
          {isPublic ? "Pública" : "Privada"}
        </label>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="outline" disabled={!publicUrl} onClick={handleCopyLink}>
                <Link2 /> Copiar enlace
              </Button>
            }
          />
          <TooltipContent>{publicUrl ? "Copiar enlace público" : "Disponible próximamente"}</TooltipContent>
        </Tooltip>
      </div>

      <TitleSearchAndAdd onAdd={handleAdd} existingMediaIds={existingMediaIds} />

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no agregaste títulos a esta lista.</p>
      ) : (
        <DndContext
          id={`list-items-${list.id}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((entry) => entry.mediaId)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((item) => (
                <SortableListItemCard
                  key={item.mediaId}
                  item={item}
                  onRemove={() => handleRemove(item)}
                  removing={removingMediaId === item.mediaId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
