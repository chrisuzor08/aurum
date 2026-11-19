import { ChartsView } from "@/components/charts/ChartList";
import { PageHeader } from "@/components/common/ui";

export const metadata = { title: "Top Charts" };

export default function ChartsPage() {
  return (
    <>
      <PageHeader eyebrow="Top Charts" title="The Top 50" description="Ranked from real listening sessions. Week: last 7 days · Month: this calendar month · Season: the last three calendar months." />
      <ChartsView />
    </>
  );
}
