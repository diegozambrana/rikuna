"use client"

import Link from "next/link"
import { Pencil, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ListWithItemCount } from "@/services"
import { CreateListDialog } from "./CreateListDialog"

export function ListGrid({ lists }: { lists: ListWithItemCount[] }) {
  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">Todavía no tienes listas.</p>
        <CreateListDialog
          trigger={
            <Button>
              <Plus /> Nueva lista
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CreateListDialog
          trigger={
            <Button>
              <Plus /> Nueva lista
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <Card key={list.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>
                  <Link href={`/mis-listas/${list.slug}`} className="hover:underline">
                    {list.name}
                  </Link>
                </CardTitle>
                <CreateListDialog
                  list={list}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label="Editar lista">
                      <Pencil />
                    </Button>
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Badge variant={list.isPublic ? "default" : "outline"}>
                {list.isPublic ? "Pública" : "Privada"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {list.itemCount} {list.itemCount === 1 ? "título" : "títulos"}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
