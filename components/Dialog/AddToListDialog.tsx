"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { addListItemAction, getListsContainingMediaAction, removeListItemAction } from "@/actions/lists"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { ListWithContainsFlag } from "@/services"

// Renders its own trigger + Dialog so it is fully self-contained — no
// assumptions about where it's mounted. RIK-9 will pass its own trigger
// button from /titulo/[slug]; this ticket only ships the component.
export function AddToListDialog({
  mediaId,
  trigger,
}: {
  mediaId: string
  trigger: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  // null = not fetched yet for this session (renders the loading state);
  // stays cached across re-opens instead of resetting, since resetting would
  // need a synchronous setState in the effect body.
  const [lists, setLists] = useState<ListWithContainsFlag[] | null>(null)
  const [pendingListId, setPendingListId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const loading = open && lists === null

  useEffect(() => {
    if (!open) return

    let cancelled = false

    getListsContainingMediaAction(mediaId)
      .then((result) => {
        if (!cancelled) setLists(result)
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudieron cargar tus listas.")
      })

    return () => {
      cancelled = true
    }
  }, [open, mediaId])

  function handleToggle(list: ListWithContainsFlag, checked: boolean) {
    setPendingListId(list.id)
    startTransition(async () => {
      try {
        if (checked) {
          await addListItemAction(list.id, mediaId, list.slug)
          toast.success(`Se agregó a "${list.name}".`)
        } else {
          await removeListItemAction(list.id, mediaId, list.slug)
          toast.success(`Se quitó de "${list.name}".`)
        }
        setLists((prev) =>
          prev?.map((entry) => (entry.id === list.id ? { ...entry, containsMedia: checked } : entry)) ?? prev
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar la lista.")
      } finally {
        setPendingListId(null)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar a lista</DialogTitle>
          <DialogDescription>Elige en qué listas quieres incluir este título.</DialogDescription>
        </DialogHeader>

        {loading && <p className="text-xs text-muted-foreground">Cargando tus listas...</p>}

        {!loading && lists?.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Todavía no tienes listas. Crea una desde Mis listas.
          </p>
        )}

        {!loading && lists && lists.length > 0 && (
          <div className="flex flex-col gap-2">
            {lists.map((list) => (
              <Label
                key={list.id}
                htmlFor={`add-to-list-${list.id}`}
                className="flex items-center gap-2 border border-border px-2.5 py-2"
              >
                <Checkbox
                  id={`add-to-list-${list.id}`}
                  checked={list.containsMedia}
                  disabled={pendingListId === list.id}
                  onCheckedChange={(checked) => handleToggle(list, checked === true)}
                />
                {list.name}
              </Label>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
