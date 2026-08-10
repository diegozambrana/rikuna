import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { CastMember } from "@/services"

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function CastList({ cast }: { cast: CastMember[] }) {
  if (cast.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium text-muted-foreground">Elenco</h2>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {cast.map((member) => (
          <div key={member.person.id} className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
            <Avatar size="lg">
              {member.person.photoUrl && (
                <AvatarImage src={member.person.photoUrl} alt={member.person.name} />
              )}
              <AvatarFallback>{initials(member.person.name)}</AvatarFallback>
            </Avatar>
            <p className="line-clamp-2 text-[11px] leading-tight font-medium">{member.person.name}</p>
            {member.characterName && (
              <p className="line-clamp-1 text-[10px] text-muted-foreground">{member.characterName}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
