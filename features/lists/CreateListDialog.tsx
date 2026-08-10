"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createListAction, renameListAction } from "@/actions/lists"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UserList } from "@/types"

// Reused for both "Nueva lista" (create) and rename — passing `list` switches
// modes. Slug is never submitted for edit as an editable field: it's carried
// as a hidden input only so the rename action knows which detail path to
// revalidate. Submission is handled manually (not useActionState) so success
// can close the dialog from the same event handler that triggered the
// action, instead of an effect reacting to state.
export function CreateListDialog({
  list,
  trigger,
}: {
  list?: UserList
  trigger: React.ReactElement
}) {
  const isEdit = Boolean(list)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)

    startTransition(async () => {
      const action = isEdit ? renameListAction : createListAction
      const result = await action({ status: "idle" }, formData)

      if (result.status === "error") {
        setError(result.message)
        return
      }

      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lista" : "Nueva lista"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Cambia el nombre o la descripción." : "Dale un nombre a tu nueva lista."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isEdit && <input type="hidden" name="id" value={list!.id} />}
          {isEdit && <input type="hidden" name="slug" value={list!.slug} />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={list?.name} required maxLength={120} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Input id="description" name="description" defaultValue={list?.description ?? ""} maxLength={280} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear lista"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
