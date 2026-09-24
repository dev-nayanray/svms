const JOURNEY = [
  "Lead", "Counselling", "Student Registration", "Profile Assessment",
  "Country Selection", "University Selection", "Course Selection",
  "Document Collection", "University Application", "Offer Letter",
  "Deposit", "Visa Preparation", "Visa Submission", "Biometrics",
  "Interview", "Visa Decision", "Travel Preparation", "Europe",
];

export function JourneyTimeline() {
  return (
    <section className="py-16 md:py-24 bg-brand-gradient text-primary-foreground">
      <div className="container-marketing">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-300">
            The signature journey
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Eighteen stages, one connected platform
          </h2>
          <p className="mt-4 text-base text-primary-foreground/80 text-pretty">
            From first contact to landing in Europe, Euroscope manages every step —
            so nothing falls through the cracks.
          </p>
        </div>

        <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNEY.map((stage, i) => (
            <li
              key={stage}
              className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 p-3 backdrop-blur-sm"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-500 text-sm font-bold text-accent-900">
                {i + 1}
              </span>
              <span className="text-sm font-medium">{stage}</span>
            </li>
          ))}
        </ol>

        <p className="mt-10 text-center text-sm text-primary-foreground/70">
          The final destination: <span className="font-semibold text-accent-300">Europe 🇪🇺</span>
        </p>
      </div>
    </section>
  );
}
