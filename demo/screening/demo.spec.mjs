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
  const points = page.getByRole("spinbutton", { name: /^Points 1/ });
  await points.fill("36");
  await expect(page.getByRole("button", { name: "Publish rubric version" })).toBeDisabled();
  await page.getByRole("spinbutton", { name: /^Points 2/ }).fill("24");
  await page.getByRole("button", { name: "Publish rubric version" }).click();
  await expect(page.getByText("New rubric version published.")).toBeVisible();
  await page.getByLabel("Rubric version").selectOption("1");
  await expect(points).toHaveValue("35");
  await expect(points).toBeDisabled();
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
  await page.getByRole("button", { name: "Batch Resume Evaluation" }).click();
  await expect(page.getByText("Processed 3 of 3")).toBeVisible();

  const routed = page.getByRole("button", { name: /Synthetic Warehouse Picker Routing/ });
  await routed.click();
  await expect(page.getByText("Weighted resume evaluation", { exact: true })).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Download private resume" }).click();
  const popup = await popupPromise;
  await expect(popup.locator("body")).toContainText("Assisted a team lead");
  await popup.close();
  await page.getByText("ATS interview calendar", { exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2027-01-20");
  await page.getByLabel("Start", { exact: true }).fill("10:00");
  await page.getByLabel("End", { exact: true }).fill("10:30");
  await page.getByRole("button", { name: "Schedule interview", exact: true }).click();
  await expect(page.getByText("History and attendance (1)")).toBeVisible();
  await page.getByLabel("Follow-up decision").selectOption("interview");
  const weights = page.getByRole("group", { name: /Recruiter points/ }).getByRole("spinbutton");
  for (const [index, points] of [30, 25, 15, 10].entries()) await weights.nth(index).fill(String(points));
  await page.getByLabel("Verified resume evidence").fill("Verified the synthetic inventory excerpt.");
  await page.getByRole("textbox", { name: /^Recruiter notes/ }).fill("Synthetic interview approved.");
  await page.getByLabel("Mark screening review complete").check();
  await page.getByRole("button", { name: "Save recruiter review" }).click();
  await expect(routed).toContainText("Review complete");
  await expect(page.getByText("Recruiter-verified evaluation · 80 / 100")).toBeVisible();
  await page.getByRole("button", { name: "Regenerate evidence draft" }).click();
  await expect(page.getByText("Evidence draft ready for verification.")).toBeVisible();
  await expect(page.getByText("Recruiter-verified evaluation · 80 / 100")).toBeVisible();

  await page.reload();
  await screening();
  await select("Warehouse Packer");
  await routed.click();
  await expect(page.getByRole("textbox", { name: /^Recruiter notes/ })).toHaveValue("Synthetic interview approved.");
  await expect(page.getByLabel("Follow-up decision")).toHaveValue("interview");
  await expect(page.getByText("Weighted resume evaluation", { exact: true })).toBeVisible();
  await page.getByText("ATS interview calendar", { exact: true }).click();
  await expect(page.getByText("History and attendance (1)")).toBeVisible();
  await expect(page.getByText("Recruiter-verified evaluation · 80 / 100")).toBeVisible();
  await expect(page.getByRole("cell", { name: "80 / 100 · v1" })).toBeVisible();
  await page.getByLabel("Sort applicants").selectOption("verified");
  await expect(page.getByRole("rowheader").first()).toHaveText("Synthetic Warehouse Picker Routing");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
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

test("Warehouse Middle A saves a review without scheduling and advances only by explicit request", async ({ page }) => {
  const name = "Synthetic Warehouse Middle (Hybrid Maintenance) A";
  const selectApplicant = async () => {
    await page.getByRole("button", { name: "Applicant Screening", exact: true }).click();
    await page.getByRole("combobox", { name: "Position", exact: true })
      .selectOption({ label: "Warehouse Middle (Hybrid Maintenance) · open" });
    await page.getByRole("button", { name: /^Synthetic Warehouse Middle \(Hybrid Maintenance\) A\b/ }).click();
  };
  const comparisonRow = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name, exact: true }) });
  const detail = page.locator("#screening-selected-application");
  const form = detail.locator("form").filter({ hasText: "Save recruiter review" });
  const points = form.getByRole("spinbutton");
  const notes = form.getByRole("textbox", { name: /^Recruiter notes/ });
  const decision = form.getByLabel("Follow-up decision");
  const time = form.getByLabel("Screening follow-up time (local)");
  const advance = form.getByRole("checkbox", { name: /Move this candidate/ });
  const save = () => form.getByRole("button", { name: "Save recruiter review" }).click();
  const assignmentStage = () => page.evaluate(() => JSON.parse(localStorage.getItem("orion-screening-demonstration-v1"))
    .assignments.find(item => item.candidate_id.endsWith("000000000022-A-candidate"))?.stage);

  await page.goto("/ats");
  await selectApplicant();
  const answer = detail.getByText(/I replaced worn tape-machine rollers/);
  await expect(answer).toBeHidden();
  await detail.getByText(/Assessment answers · Version 1/).click();
  await expect(answer).toBeVisible();
  await expect(detail.getByText(/I would block off the wet walkway/)).toBeVisible();
  await expect(advance).toBeDisabled();
  await expect(form.getByText(/Enter a follow-up date and time to enable/)).toBeVisible();
  await expect(time).toHaveValue("");
  await detail.getByRole("button", { name: "Generate evidence draft" }).click();

  for (const [index, value] of [36, 20, 18, 12].entries()) await points.nth(index).fill(String(value));
  await notes.fill("Verified preventive maintenance and safe escalation.");
  await decision.selectOption("contact");
  await form.getByLabel("Mark screening review complete").check();
  await save();
  await expect(detail.getByRole("alert")).toContainText("enter a whole number from 0 to 35");
  await expect(points.first()).toHaveValue("36");
  await expect(notes).toHaveValue("Verified preventive maintenance and safe escalation.");
  await expect(decision).toHaveValue("contact");
  await expect(comparisonRow.getByRole("cell", { name: "Pending", exact: true })).toBeVisible();

  await points.first().fill("30");
  const meeting = form.getByLabel("Screening meeting URL (optional)");
  await meeting.fill("https://example.test/synthetic");
  await save();
  await expect(detail.getByRole("alert")).toContainText("Leave the meeting URL blank");
  await expect(points.first()).toHaveValue("30");
  await expect(notes).toHaveValue("Verified preventive maintenance and safe escalation.");
  await expect(decision).toHaveValue("contact");
  await meeting.clear();
  await save();
  await expect(detail.getByText("Recruiter review saved.", { exact: true })).toBeVisible();
  await expect(comparisonRow.getByRole("cell", { name: "Complete", exact: true })).toBeVisible();
  await expect(comparisonRow.getByRole("cell", { name: "Call candidate", exact: true })).toBeVisible();
  await expect(comparisonRow.getByRole("cell", { name: "80 / 100 · v1" }).locator("strong")).toBeVisible();
  expect(await assignmentStage()).toBe("new");

  await page.reload();
  await selectApplicant();
  await expect(notes).toHaveValue("Verified preventive maintenance and safe escalation.");
  await expect(decision).toHaveValue("contact");
  await expect(time).toHaveValue("");
  await detail.getByRole("button", { name: "Regenerate evidence draft" }).click();
  await expect(detail.getByText("Evidence draft ready for verification.")).toBeVisible();
  await expect(comparisonRow.getByRole("cell", { name: "80 / 100 · v1" })).toBeVisible();
  await expect(notes).toHaveValue("Verified preventive maintenance and safe escalation.");

  await detail.getByText("ATS interview calendar", { exact: true }).click();
  await detail.getByLabel("Date", { exact: true }).fill("2027-02-10");
  await detail.getByLabel("Start", { exact: true }).fill("10:00");
  await detail.getByLabel("End", { exact: true }).fill("10:30");
  await detail.getByRole("button", { name: "Schedule interview", exact: true }).click();
  await expect(detail.getByText("History and attendance (1)")).toBeVisible();
  expect(await assignmentStage()).toBe("new");

  await time.fill("2027-02-10T10:00");
  await expect(advance).toBeEnabled();
  await expect(advance).not.toBeChecked();
  await advance.check();
  await save();
  await expect(detail.getByText("Recruiter review saved.", { exact: true })).toBeVisible();
  expect(await assignmentStage()).toBe("interview");
  await expect(advance).not.toBeChecked();
});
