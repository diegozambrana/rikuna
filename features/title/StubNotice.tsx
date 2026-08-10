import { Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function StubNotice() {
  return (
    <Alert>
      <Info />
      <AlertTitle>Información limitada</AlertTitle>
      <AlertDescription>Este título se completará pronto.</AlertDescription>
    </Alert>
  )
}
