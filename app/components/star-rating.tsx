import { useFetcher } from "react-router";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

interface StarRatingProps{
    average: number|null;
    count: number;
    readOnly?: boolean;
    userRating?: number|null
}
const STARS = [1,2,3,4,5];

function Summary({average, count}:{average: number|null ; count: number}){
    if (count==0||average===null){
        return <span className="text-xs text-muted-foreground">No ratings yet</span>
    }
    return(
        <span className="text-xs text-muted-foreground">
            {average.toFixed(1)} ({count} {count===1 ? "rating" : "ratings"})
        </span>
    )
}

export function StarRating({
  average,
  count,
  readOnly = false,
  userRating = null,
}: StarRatingProps) {
  const fetcher = useFetcher();

  if (readOnly) {
    const filled = Math.round(average ?? 0);
    return (
      <div className="flex items-center gap-1.5">
        <span className="flex" aria-label={`Rated ${average?.toFixed(1) ?? 0} out of 5`}>
          {STARS.map((n) => (
            <Star
              key={n}
              className={cn(
                "size-4",
                n <= filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
              )}
            />
          ))}
        </span>
        <Summary average={average} count={count} />
      </div>
    );
  }

  // Show the pending rating immediately while the request is in flight
  const pending = fetcher.formData?.get("rating");
  const selected = pending ? Number(pending) : userRating ?? 0;

  return (
    <div className="flex items-center gap-1.5">
      <fetcher.Form method="post" className="flex">
        <input type="hidden" name="intent" value="rate" />
        {STARS.map((n) => (
          <button
            key={n}
            type="submit"
            name="rating"
            value={n}
            aria-label={`Rate ${n} out of 5`}
            disabled={fetcher.state !== "idle"}
            className="p-0.5"
          >
            <Star
              className={cn(
                "size-5",
                n <= selected ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
              )}
            />
          </button>
        ))}
      </fetcher.Form>
      <Summary average={average} count={count} />
    </div>
  );
}