"use client";

import { useActionState } from "react";
import {
  requestLoginLink,
  saveWishlistItem,
  type FormState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const empty: FormState = {};

function Feedback({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-sm text-primary">
        {state.success}
      </p>
    );
  }
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(requestLoginLink, empty);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Add to wishlist, or update the target price of a game already on it. */
export function WishlistForm({
  gameId,
  onWishlist,
  targetCents,
  compact = false,
}: {
  gameId: string;
  onWishlist: boolean;
  targetCents: number | null;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveWishlistItem.bind(null, gameId),
    empty,
  );
  const inputId = `target-${gameId}`;

  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={inputId} className={compact ? "sr-only" : undefined}>
            Target price in USD (optional)
          </Label>
          <Input
            id={inputId}
            name="target"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="e.g. 9.99"
            defaultValue={targetCents !== null ? (targetCents / 100).toFixed(2) : ""}
            className="w-32"
          />
        </div>
        <Button type="submit" variant={onWishlist ? "outline" : "default"} disabled={pending}>
          {pending ? "Saving…" : onWishlist ? "Update target" : "Add to wishlist"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
