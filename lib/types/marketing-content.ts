/**
 * Marketing content types + defaults — extracted into a separate file
 * so client components can import them WITHOUT pulling in the Prisma
 * client (which is server-only and causes a 500 on Vercel when bundled
 * into client-side code).
 *
 * The service layer (lib/services/marketing-content.ts) imports from
 * this file for the types + defaults, and adds the Prisma read/write
 * logic on top.
 */

export type IconKey = string;

export type ContentItem = {
  icon: IconKey;
  title: string;
  description: string;
};

export type MarketingContent = {
  hero: {
    badge: string;
    headlinePart1: string;
    headlinePart2: string;
    subtitle: string;
    ctaPrimaryText: string;
    ctaPrimaryHref: string;
    ctaSecondaryText: string;
    ctaSecondaryHref: string;
    trustLine: string;
  };
  services: ContentItem[];
  whyEuroscope: ContentItem[];
  howWeHelp: ContentItem[];
  problems: ContentItem[];
  trust: ContentItem[];
  cta: {
    eyebrow: string;
    headlinePart1: string;
    headlinePart2: string;
    subtitle: string;
    ctaPrimaryText: string;
    ctaPrimaryHref: string;
    ctaSecondaryText: string;
    ctaSecondaryHref: string;
  };
  faq: { q: string; a: string }[];
};

export const DEFAULT_MARKETING_CONTENT: MarketingContent = {
  hero: {
    badge: "European Education Consultancy",
    headlinePart1: "Study in Europe.",
    headlinePart2: "Start Your Future.",
    subtitle:
      "Euroscope is a European education consultancy that guides students through every step — from choosing the right university to preparing your visa. We don't just give you a portal — we walk with you.",
    ctaPrimaryText: "Book a Free Consultation",
    ctaPrimaryHref: "/contact",
    ctaSecondaryText: "Explore Europe",
    ctaSecondaryHref: "/study-in-europe",
    trustLine: "Personalized guidance · End-to-end support · European expertise",
  },
  services: [
    { icon: "comments", title: "Personal Counselling", description: "One-on-one sessions with experienced counselors who understand European education. We assess your profile, goals and budget — then recommend the right path." },
    { icon: "graduationCap", title: "University Selection", description: "We help you choose the right European university based on your academic background, career goals and financial situation — not just rankings." },
    { icon: "clipboardCheck", title: "Application Management", description: "We handle your university applications end-to-end — forms, documents, deadlines and follow-ups — so nothing falls through the cracks." },
    { icon: "fileLines", title: "Document Guidance", description: "We guide you through every document — transcripts, motivation letters, recommendations, financial proof — and review each one before submission." },
    { icon: "planeDeparture", title: "Visa Preparation", description: "We prepare your visa application with country-specific checklists, financial documentation guidance and interview coaching — every step of the way." },
    { icon: "envelope", title: "Travel & Arrival Support", description: "We help with pre-departure preparation — accommodation guidance, travel planning and what to expect when you arrive in Europe." },
  ],
  whyEuroscope: [
    { icon: "earthEurope", title: "European Focus", description: "We specialize in European education. Our counselors understand the nuances of each country's university system, visa process and culture." },
    { icon: "users", title: "Personal Counselors", description: "You work with a dedicated counselor who knows your case — not a call center. One person, one relationship, end-to-end support." },
    { icon: "handshake", title: "End-to-End Support", description: "We don't just submit forms and disappear. We walk with you from the first consultation to your arrival in Europe." },
    { icon: "eye", title: "Transparent Process", description: "You see every step of your application — what's done, what's pending, what's next. No black boxes, no surprises." },
    { icon: "clock", title: "Deadline Management", description: "Multiple university intakes, visa appointments and document deadlines — we track them all so you never miss a date." },
    { icon: "shieldCheck", title: "Honest Guidance", description: "We don't make promises we can't keep. No guaranteed visas, no fake success rates — just honest, expert advice." },
  ],
  howWeHelp: [
    { icon: "lightbulb", title: "Free Consultation", description: "We start with a free, no-obligation consultation. Tell us about your goals, background and budget — we'll tell you if Europe is right for you." },
    { icon: "route", title: "Personalized Plan", description: "Your counselor creates a personalized roadmap — target countries, universities, courses, timeline and document checklist — based on your profile." },
    { icon: "peopleArrows", title: "Application Support", description: "We handle your applications — forms, documents, deadlines, follow-ups. You see every step, we handle the heavy lifting." },
    { icon: "plane", title: "Visa & Travel", description: "Once you have your offer, we guide you through visa preparation, interviews and travel planning — right up to your arrival in Europe." },
  ],
  problems: [
    { icon: "fileQuestion", title: "Too Much Information", description: "Finding reliable university and course information across hundreds of European institutions can be overwhelming." },
    { icon: "layerGroup", title: "Complicated Applications", description: "Different universities have different requirements, deadlines and application portals — easy to miss something." },
    { icon: "triangleWarning", title: "Document Confusion", description: "Students often struggle to track which documents are required, which are approved, and which need re-submission." },
    { icon: "passport", title: "Visa Preparation", description: "Visa preparation requires careful planning, financial proof and timely documentation — with high stakes." },
    { icon: "calendarXmark", title: "Missed Deadlines", description: "Multiple university intakes, visa appointments and document deadlines can be difficult to manage together." },
    { icon: "poorCommunication", title: "Poor Communication", description: "Students may not know the current status of their application — left waiting without updates for weeks." },
  ],
  trust: [
    { icon: "lock", title: "Secure Authentication", description: "Password-based login with bcrypt hashing, JWT sessions with periodic DB re-validation, and rate limiting on sensitive endpoints." },
    { icon: "userShield", title: "Role-Based Access", description: "Three distinct roles — Admin, Employee and Student — each with their own panel, scoped data access and permission matrix." },
    { icon: "folderLock", title: "Private Document Access", description: "Files stored under private storage (never under /public). Download endpoints verify ownership server-side and stream with no-store cache headers." },
    { icon: "scroll", title: "Audit Logging", description: "Critical actions — password changes, document uploads, status changes — are recorded with IP, user agent and old/new values for compliance." },
  ],
  cta: {
    eyebrow: "Get Started",
    headlinePart1: "Your European Future",
    headlinePart2: "Starts Here.",
    subtitle:
      "Talk to our counselors and get a personalized plan for your European study journey. No pressure, no obligation — just honest guidance.",
    ctaPrimaryText: "Book a Free Consultation",
    ctaPrimaryHref: "/contact",
    ctaSecondaryText: "Explore Destinations",
    ctaSecondaryHref: "/study-in-europe",
  },
  faq: [
    { q: "What is Euroscope?", a: "Euroscope is a European education and student visa management platform. It helps students manage their entire journey — from choosing a university to preparing their visa application — in one organized place." },
    { q: "Which European countries can I study in?", a: "Euroscope supports applications to universities across major European study destinations including Germany, France, Italy, Spain, the Netherlands, Sweden, Finland, Denmark, Ireland and more." },
    { q: "How can I get started?", a: 'Click "Book a Free Consultation" to schedule a call. We\'ll walk you through the platform and help you start your European study journey.' },
  ],
};
