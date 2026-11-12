import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { formatUsd, type AlertReason } from "@/lib/alerts";

export function LoginEmail({ url }: { url: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your Deal Tracker sign-in link</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>Deal Tracker</Text>
          <Heading style={heading}>Sign in</Heading>
          <Text style={paragraph}>
            Use the button below to sign in. The link works once and expires in
            20 minutes.
          </Text>
          <Button href={url} style={button}>
            Sign in to Deal Tracker
          </Button>
          <Text style={small}>
            If you did not ask for this, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export type AlertEmailItem = {
  title: string;
  reason: AlertReason;
  priceCents: number;
  previousCents: number | null;
  retailCents: number;
  targetCents: number | null;
  storeName: string;
  /** CheapShark redirect link */
  url: string;
};

const reasonText: Record<AlertReason, (item: AlertEmailItem) => string> = {
  target: (item) =>
    `At or below your target of ${formatUsd(item.targetCents ?? item.priceCents)}`,
  "all-time-low": () => "Lowest price ever recorded",
  drop: (item) =>
    item.previousCents !== null
      ? `Down from ${formatUsd(item.previousCents)}`
      : "Price dropped",
};

export function alertSubject(items: AlertEmailItem[]): string {
  if (items.length === 1) {
    return `${items[0].title} is now ${formatUsd(items[0].priceCents)}`;
  }
  return `${items.length} games on your wishlist dropped in price`;
}

export function DealAlertEmail({
  items,
  wishlistUrl,
}: {
  items: AlertEmailItem[];
  wishlistUrl: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{alertSubject(items)}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>Deal Tracker</Text>
          <Heading style={heading}>
            {items.length === 1 ? "A price dropped" : "Prices dropped"} on your
            wishlist
          </Heading>

          {items.map((item) => (
            <Section key={item.url} style={card}>
              <Text style={gameTitle}>{item.title}</Text>
              <Text style={price}>
                {formatUsd(item.priceCents)}
                {item.retailCents > item.priceCents ? (
                  <span style={was}> was {formatUsd(item.retailCents)}</span>
                ) : null}
              </Text>
              <Text style={small}>
                {reasonText[item.reason](item)} · at {item.storeName}
              </Text>
              <Button href={item.url} style={button}>
                Get this deal
              </Button>
            </Section>
          ))}

          <Hr style={hr} />
          <Text style={small}>
            You are getting this because these games are on your{" "}
            <Link href={wishlistUrl}>wishlist</Link>. Remove a game there to stop
            alerts for it. Prices and links are provided by CheapShark.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f2f3f7",
  fontFamily: "Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "24px 0",
};
const container = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  maxWidth: "520px",
  padding: "32px",
};
const brand = { color: "#1a7f4b", fontSize: "13px", fontWeight: 700, margin: 0 };
const heading = { color: "#14161f", fontSize: "22px", margin: "8px 0 12px" };
const paragraph = { color: "#3a3f52", fontSize: "15px", lineHeight: "22px" };
const card = {
  backgroundColor: "#f2f3f7",
  borderRadius: "8px",
  margin: "12px 0",
  padding: "12px 16px 16px",
};
const gameTitle = { color: "#14161f", fontSize: "16px", fontWeight: 700, margin: "4px 0 0" };
const price = { color: "#1a7f4b", fontSize: "22px", fontWeight: 700, margin: "4px 0" };
const was = { color: "#6b7186", fontSize: "14px", fontWeight: 400 };
const button = {
  backgroundColor: "#1a7f4b",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  padding: "10px 18px",
  textDecoration: "none",
};
const small = { color: "#6b7186", fontSize: "13px", lineHeight: "20px" };
const hr = { borderColor: "#e2e4ec", margin: "24px 0 12px" };
