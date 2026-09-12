/**
 * FAQ data for the Student Support module (Module 16).
 *
 * These are static FAQ entries — they don't live in the DB because
 * they're general knowledge questions that don't change per student.
 * If the FAQ ever needs to be admin-managed, this can be migrated
 * to a DB-backed model with no UI changes (the API route would just
 * fetch from DB instead of returning this constant).
 */

export type FAQCategory =
  | "Application"
  | "Documents"
  | "University"
  | "Visa"
  | "Payments"
  | "Appointments"
  | "Account";

export const FAQ_CATEGORIES: FAQCategory[] = [
  "Application",
  "Documents",
  "University",
  "Visa",
  "Payments",
  "Appointments",
  "Account",
];

export type FAQItem = {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FAQItem[] = [
  // Application
  {
    id: "app-1",
    category: "Application",
    question: "How do I start my application?",
    answer: "Your counselor will create an application for you once you've selected a university and course. You can browse universities on the Universities page and request counseling to get started.",
  },
  {
    id: "app-2",
    category: "Application",
    question: "What does each application stage mean?",
    answer: "Your application moves through 18 stages: Lead → Counseling → Profile Assessment → Country Selection → University Selection → Document Collection → Application Submitted → Conditional Offer → Unconditional Offer → Deposit Payment → Confirmation → Visa Preparation → Visa Submitted → Biometrics → Interview → Visa Decision → Travel Preparation → Completed.",
  },
  {
    id: "app-3",
    category: "Application",
    question: "Can I have multiple applications?",
    answer: "Yes, you can have applications to multiple universities. Use the application selector at the top of the Application page to switch between them.",
  },
  // Documents
  {
    id: "doc-1",
    category: "Documents",
    question: "How do I upload a document?",
    answer: "Go to the Documents page, find the requested document card, and tap 'Upload'. You can upload PDF, JPG, PNG, or WebP files up to 10MB.",
  },
  {
    id: "doc-2",
    category: "Documents",
    question: "My document was rejected — what do I do?",
    answer: "The rejection reason is shown on the document card. Tap 'Upload New Version' to replace it with a corrected version. The old version is preserved in the document's history.",
  },
  {
    id: "doc-3",
    category: "Documents",
    question: "Are my documents secure?",
    answer: "Yes. All documents are stored in private storage — they're never publicly accessible. Only you and your assigned counselor/admin can access them through the system.",
  },
  // University
  {
    id: "uni-1",
    category: "University",
    question: "How do I find universities?",
    answer: "Go to the Universities page. You can search by name, country, or city, and filter by country, ranking, and application fee. Save your favorites by tapping the heart icon.",
  },
  {
    id: "uni-2",
    category: "University",
    question: "Can I request counseling for a specific university?",
    answer: "Yes. On the university detail page, tap 'Request Counseling'. Your counselor will be notified and will reach out to discuss the university and course options.",
  },
  // Visa
  {
    id: "visa-1",
    category: "Visa",
    question: "When does visa tracking start?",
    answer: "Visa tracking begins once your application reaches the 'Visa Preparation' stage. You'll see the visa status card, timeline, requirements, and key dates on the Visa page.",
  },
  {
    id: "visa-2",
    category: "Visa",
    question: "What are the visa requirements for my country?",
    answer: "The Visa page shows country-specific requirements. Each requirement shows whether it's required or optional, along with a description of what's needed.",
  },
  // Payments
  {
    id: "pay-1",
    category: "Payments",
    question: "How do I pay my fees?",
    answer: "Your counselor will record payments on your behalf. You can view your payment history and outstanding balances on the Payments page. If you have an outstanding balance, contact your counselor to arrange payment.",
  },
  {
    id: "pay-2",
    category: "Payments",
    question: "What payment methods are supported?",
    answer: "Cash, Bank Transfer, bKash, Nagad, Card, and Other. Your counselor will help you choose the best method for your situation.",
  },
  // Appointments
  {
    id: "apt-1",
    category: "Appointments",
    question: "How do I schedule an appointment?",
    answer: "Your counselor schedules appointments for you. You'll see them on the Appointments page. You can confirm or cancel scheduled appointments — you cannot create new ones yourself.",
  },
  {
    id: "apt-2",
    category: "Appointments",
    question: "Can I cancel an appointment?",
    answer: "Yes. On the Appointments page, tap 'Cancel' on a SCHEDULED or CONFIRMED appointment. Your counselor will be notified. You cannot cancel COMPLETED or NO_SHOW appointments.",
  },
  // Account
  {
    id: "acc-1",
    category: "Account",
    question: "How do I update my profile?",
    answer: "Go to the Profile page. You can edit your personal information, contact details, address, passport information, and emergency contact. Some fields like your email require verification through a separate flow.",
  },
  {
    id: "acc-2",
    category: "Account",
    question: "How do I change my password?",
    answer: "Password changes are handled through the Settings page. If you've forgotten your password, use the 'Forgot Password' link on the login page.",
  },
  {
    id: "acc-3",
    category: "Account",
    question: "Can I use the app offline?",
    answer: "Yes, the app is a PWA (Progressive Web App). You can install it on your phone for a native-app experience. Some features require an internet connection, but you can browse cached content offline.",
  },
];
