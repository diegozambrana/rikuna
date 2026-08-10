import Link from "next/link"
import { MediaCard } from "@/components/MediaCard"
import type { PublicListView } from "@/services"

// Read-only render of a shared list for an anonymous visitor — zero
// session-dependent affordances (no onMarkWatched, no add/remove controls).
export function PublicListGrid({ list }: { list: PublicListView }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-2xl font-medium">{list.name}</h1>
        {list.description && <p className="text-sm text-muted-foreground">{list.description}</p>}
      </div>

      {list.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta lista todavía no tiene títulos.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {list.items.map((item) => (
            <Link key={item.id} href={`/titulo/${item.slug}`}>
              <MediaCard
                title={item.title}
                year={item.year}
                posterUrl={item.posterUrl}
                imdbRating={item.imdbRating}
                isStub={item.isStub}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
