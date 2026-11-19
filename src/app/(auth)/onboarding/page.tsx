import { requirePageUser } from "@/lib/auth";
import { getArtistCards, getFacets } from "@/lib/catalog";
import { OnboardingForm } from "@/components/auth/OnboardingForm";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requirePageUser("/onboarding");
  const [genres, moods, artists] = await Promise.all([getFacets("genre"), getFacets("mood"), getArtistCards(30)]);
  return (
    <OnboardingForm
      displayName={user.displayName || user.username}
      genres={genres.map((g) => ({ value: g.value, label: g.value }))}
      moods={moods.map((m) => ({ value: m.value, label: m.value }))}
      artists={artists.map((a) => ({ id: a.id, name: a.name }))}
    />
  );
}
