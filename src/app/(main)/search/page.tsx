import { SearchView } from "@/components/search/SearchView";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; genre?: string; mood?: string }> }) {
  const sp = await searchParams;
  return <SearchView initialQuery={sp.q ?? ""} initialGenre={sp.genre ?? null} initialMood={sp.mood ?? null} />;
}
