import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "deal-tracker",
  // Outside production, talk to the local Inngest dev server (`npm run inngest`)
  // unless real Inngest keys have been provided.
  isDev:
    process.env.NODE_ENV !== "production" && !process.env.INNGEST_SIGNING_KEY
      ? true
      : undefined,
});
