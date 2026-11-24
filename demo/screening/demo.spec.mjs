import { expect, test } from "@playwright/test";

test("recruiter exercises the persisted demonstration using the real ATS interface", async ({ page, context }) => {
  const outside = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.protocol === "blob:") return route.continue();
    outside.push(url.hostname);
    return route.abort();
  });
  const response = await page.goto("/ats");
  expect(response.headers()["content-security-policy"]).toContain("connect-src 'none'");
  await expect(page.getByText("DEMONSTRATION — SYNTHETIC DATA ONLY", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open Positions", exact: true }).click();
  await page.getByRole("button", { name: /Warehouse Middle/ }).click();
  const question = "Demonstrate a synthetic materials inspection.";
  await page.getByRole("textbox", { name: /^Question 1\b/ }).fill(question);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("button", { name: "Publish questionnaire" }).click();
  await expect(page.getByText("Questionnaire published.")).toBeVisible();
  await page.goto(await page.getByLabel("Shareable assessment link").inputValue());
  await expect(page.getByText(question)).toBeVisible();
  await expect(page.getByText("Published preview · Version 2")).toBeVisible();
  await page.goto("/ats");
  const screening = () => page.getByRole("button", { name: "Applicant Screening", exact: true }).click();
  const position = page.getByRole("combobox", { name: "Position", exact: true });
  const select = title => position.selectOption({ label: title + " · open" });
  await screening();
  for (const title of ["Warehouse Middle (Hybrid Maintenance)", "Warehouse Picker", "Warehouse Packer",
    "Production Assistant", "Cerakote Applicator", "Sales Executive"]) {
    await select(title);
    await expect(page.getByRole("button", { name: new RegExp("Synthetic " + title.replace(/[()]/g, "\\$&") + " A") })).toBeVisible();
  }

  await select("Warehouse Picker");
  const unrouted = page.getByRole("button", { name: /Synthetic Warehouse Picker Routing/ });
  await unrouted.click();
  await page.getByLabel("Application destination").selectOption({ label: "Warehouse Packer" });
  await page.getByRole("button", { name: "Confirm destination" }).click();
  await expect(unrouted).toHaveCount(0);
  await select("Warehouse Packer");
  await page.getByRole("button", { name: "Sync visible applications" }).click();
  await expect(page.getByText("Processed 2 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Generate visible evidence drafts" }).click();
  await expect(page.getByText("Processed 3 of 3")).toBeVisible();

  const routed = page.getByRole("button", { name: /Synthetic Warehouse Picker Routing/ });
  await routed.click();
  await expect(page.getByText("Preset excerpt from the synthetic resume.", { exact: false })).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Download private resume" }).click();
  const popup = await popupPromise;
  await expect(popup.locator("body")).toContainText("Checked inventory counts");
  await popup.close();
  await page.getByText("ATS interview calendar", { exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2027-01-20");
  await page.getByLabel("Start", { exact: true }).fill("10:00");
  await page.getByLabel("End", { exact: true }).fill("10:30");
  await page.getByRole("button", { name: "Schedule interview", exact: true }).click();
  await expect(page.getByText("History and attendance (1)")).toBeVisible();
  await page.getByLabel("Follow-up decision").selectOption("interview");
  await page.getByLabel("Verified resume evidence").fill("Verified the synthetic inventory excerpt.");
  await page.getByRole("textbox", { name: /^Recruiter notes/ }).fill("Synthetic interview approved.");
  await page.getByLabel("Mark screening review complete").check();
  await page.getByRole("button", { name: "Save recruiter review" }).click();
  await expect(routed).toContainText("Review complete");

  await page.reload();
  await screening();
  await select("Warehouse Packer");
  await routed.click();
  await expect(page.getByRole("textbox", { name: /^Recruiter notes/ })).toHaveValue("Synthetic interview approved.");
  await expect(page.getByLabel("Follow-up decision")).toHaveValue("interview");
  await expect(page.getByText("Preset excerpt from the synthetic resume.", { exact: false })).toBeVisible();
  await page.getByText("ATS interview calendar", { exact: true }).click();
  await expect(page.getByText("History and attendance (1)")).toBeVisible();
  expect(outside).toEqual([]);
});

test("shared ATS styles render the responsive cards and navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/ats");
  const nav = page.getByRole("navigation");
  await expect(nav).toHaveCSS("display", "flex");
  await expect(nav).toHaveCSS("column-gap", "8px");

  const cards = page.getByText("Candidates", { exact: true }).locator("../..");
  await expect(cards).toHaveCSS("display", "grid");
  await expect(cards).toHaveCSS("grid-template-columns", /^\S+ \S+ \S+ \S+$/);
  await expect(cards.getByText("Candidates", { exact: true }).locator("..")).toHaveCSS("border-top-width", "1px");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cards).toHaveCSS("grid-template-columns", /^\S+$/);
  await page.getByRole("button", { name: /Synthetic Warehouse Middle/ }).first().click();
  await expect(page.getByRole("heading", { name: "Position pipeline" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
