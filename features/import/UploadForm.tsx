"use client"

import { useActionState } from "react"
import { importImdbCsv } from "@/actions/imdb-import"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ImportSummary } from "./ImportSummary"

export function UploadForm() {
  const [state, formAction, pending] = useActionState(importImdbCsv, { status: "idle" as const })

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Importar desde IMDb</CardTitle>
          <CardDescription>
            Sube el archivo CSV exportado desde tu cuenta de IMDb (Calificaciones o Lista de
            seguimiento).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <Label>Tipo de importación</Label>
              <RadioGroup name="sourceType" defaultValue="ratings" required>
                <Label className="flex items-center gap-2">
                  <RadioGroupItem value="ratings" />
                  Calificaciones
                </Label>
                <Label className="flex items-center gap-2">
                  <RadioGroupItem value="watchlist" />
                  Lista de seguimiento
                </Label>
              </RadioGroup>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="file">Archivo CSV</Label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                className="h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none file:mr-2 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground"
              />
            </div>

            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Procesando..." : "Importar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ImportSummary state={state} />
    </div>
  )
}
