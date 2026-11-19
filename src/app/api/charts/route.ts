import { getChart, PERIOD_LABELS } from "@/lib/charts";
import { badRequest, ok, withErrors } from "@/lib/http";
import type { PeriodKey } from "@/types";

export const GET = withErrors(async (req) => {
  const period = new URL(req.url).searchParams.get("period") ?? "week";
  if (!(period in PERIOD_LABELS)) throw badRequest("period must be week, month or season");
  const entries = await getChart(period as PeriodKey);
  return ok({ period, label: PERIOD_LABELS[period as PeriodKey], entries });
});
