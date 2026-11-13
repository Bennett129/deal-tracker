import { describe, expect, it } from "vitest";
import { discountPercent, evaluateAlert, formatUsd } from "./alerts";
import { dealUrl, toCents } from "./cheapshark";
import { steamAppIdFromCapsule } from "./steam";

const base = {
  currentCents: 2000,
  previousCents: 2000,
  targetCents: null,
  cheapestEverCents: 500,
  lastAlertedCents: null,
};

describe("evaluateAlert", () => {
  it("stays quiet when the price has not moved", () => {
    expect(evaluateAlert(base)).toBeNull();
  });

  it("stays quiet when the price rises", () => {
    expect(evaluateAlert({ ...base, currentCents: 2500 })).toBeNull();
  });

  it("alerts on a drop of 5% or more", () => {
    expect(evaluateAlert({ ...base, currentCents: 1900 })).toBe("drop");
  });

  it("ignores a drop smaller than 5%", () => {
    expect(evaluateAlert({ ...base, currentCents: 1950 })).toBeNull();
  });

  it("reports an all-time low when the price falls to the lowest ever", () => {
    expect(evaluateAlert({ ...base, currentCents: 500 })).toBe("all-time-low");
    expect(evaluateAlert({ ...base, currentCents: 450 })).toBe("all-time-low");
  });

  it("does not report an all-time low that is not a new drop", () => {
    expect(
      evaluateAlert({ ...base, currentCents: 500, previousCents: 500 }),
    ).toBeNull();
  });

  it("alerts when the price falls to the target", () => {
    expect(
      evaluateAlert({ ...base, currentCents: 1500, targetCents: 1500 }),
    ).toBe("target");
  });

  it("alerts on the first check if the game is already at target", () => {
    expect(
      evaluateAlert({ ...base, currentCents: 1000, previousCents: null, targetCents: 1500 }),
    ).toBe("target");
  });

  it("does not alert on the first check without a target", () => {
    expect(evaluateAlert({ ...base, previousCents: null })).toBeNull();
  });

  it("does not repeat an alert for a price the user already knows about", () => {
    expect(
      evaluateAlert({
        ...base,
        currentCents: 1500,
        previousCents: 1500,
        targetCents: 1500,
        lastAlertedCents: 1500,
      }),
    ).toBeNull();
  });

  it("alerts again when the price goes up and comes back down", () => {
    expect(
      evaluateAlert({
        ...base,
        currentCents: 1500,
        previousCents: 2000,
        targetCents: 1500,
        lastAlertedCents: 1500,
      }),
    ).toBe("target");
  });
});

describe("price helpers", () => {
  it("converts API prices to cents without float drift", () => {
    expect(toCents("24.99")).toBe(2499);
    expect(toCents("0.00")).toBe(0);
    expect(toCents("19.999")).toBe(2000);
  });

  it("formats prices and discounts", () => {
    expect(formatUsd(2499)).toBe("$24.99");
    expect(formatUsd(0)).toBe("Free");
    expect(discountPercent(500, 2000)).toBe(75);
    expect(discountPercent(2000, 2000)).toBe(0);
  });
});

describe("dealUrl", () => {
  it("always points at the CheapShark redirect", () => {
    expect(dealUrl("abc123")).toBe("https://www.cheapshark.com/redirect?dealID=abc123");
  });

  it("encodes the deal id exactly once, whether or not the API pre-encoded it", () => {
    const expected = "https://www.cheapshark.com/redirect?dealID=a%2Fb%2Bc%3D";
    expect(dealUrl("a%2Fb%2Bc%3D")).toBe(expected);
    expect(dealUrl("a/b+c=")).toBe(expected);
  });
});

describe("steamAppIdFromCapsule", () => {
  it("finds the app id in a hashed Steam capsule URL", () => {
    expect(
      steamAppIdFromCapsule(
        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3499790/9b9f8e8896417ae73ee60cffc30b069864163878/capsule_231x87.jpg?t=1794334597",
      ),
    ).toBe("3499790");
  });

  it("finds the app id in an older unhashed capsule URL", () => {
    expect(
      steamAppIdFromCapsule("https://cdn.cloudflare.steamstatic.com/steam/apps/507490/capsule_sm_120.jpg"),
    ).toBe("507490");
  });

  it("leaves other stores' images and Steam header images alone", () => {
    expect(
      steamAppIdFromCapsule("https://cdn.humblebundle.com/misc/files/hashed/ea4b53bccf50d3165e099e604c6c7496a546914f.jpg"),
    ).toBeNull();
    expect(
      steamAppIdFromCapsule("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3499790/0c833c88/header.jpg"),
    ).toBeNull();
  });
});
