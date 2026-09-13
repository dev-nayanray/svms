import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  // Services
  faComments,
  faGraduationCap,
  faClipboardCheck,
  faFileLines,
  faPlaneDeparture,
  faEnvelopeOpenText,
  // Why Euroscope
  faEarthEurope,
  faUsers,
  faHandshake,
  faEye,
  faClock,
  faShield,
  // Problems
  faFileCircleQuestion,
  faLayerGroup,
  faTriangleExclamation,
  faPassport,
  faCalendarXmark,
  faComments as faCommentsAlt,
  // Trust
  faLock,
  faUserShield,
  faFolder,
  faScroll,
  // Hero / nav
  faArrowRight,
  faWandMagicSparkles,
  faLocationDot,
  faCompass,
  faUserGraduate,
  faStar,
  faChevronDown,
  faGlobe,
  faBars,
  faXmark,
  // Journey
  faPenToSquare,
  faCommentDots,
  faUserPlus,
  faListCheck,
  faMapLocationDot,
  faBuildingColumns,
  faBookOpen,
  faFolderOpen,
  faPaperPlane,
  faMailBulk,
  faCreditCard,
  faPassport as faPassportVisa,
  faFileInvoice,
  faFingerprint,
  faMicrophone,
  faCircleCheck,
  faSuitcaseRolling,
  // How we help
  faLightbulb,
  faRoute,
  faPeopleArrows,
  faPlane,
  // Misc
  faPhone,
  faEnvelope,
  faClock as faClockAlt,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

// Re-export the FontAwesomeIcon component for easy use
export { FontAwesomeIcon };

/** Type alias for a Font Awesome icon — used by FeatureCard etc. */
export type FaIconType = IconDefinition;

/**
 * Central icon registry for the Euroscope marketing site.
 *
 * WHY FONT AWAKE
 * ==============
 * The user specifically requested Font Awesome icons instead of emoji
 * or AI-generated icons. Font Awesome is the industry-standard icon
 * library — 2000+ consistent, professional, vector icons that render
 * identically across all platforms (no emoji rendering inconsistency).
 *
 * USAGE
 * =====
 *   import { FaIcon, ICONS } from "@/components/marketing/icons";
 *   <FaIcon icon={ICONS.comments} className="h-5 w-5" />
 *
 * Or use FontAwesomeIcon directly:
 *   <FontAwesomeIcon icon={faComments} className="h-5 w-5" />
 */
export const ICONS = {
  // Services
  comments: faComments,
  graduationCap: faGraduationCap,
  clipboardCheck: faClipboardCheck,
  fileLines: faFileLines,
  planeDeparture: faPlaneDeparture,
  envelope: faEnvelopeOpenText,

  // Why Euroscope
  earthEurope: faEarthEurope,
  users: faUsers,
  handshake: faHandshake,
  eye: faEye,
  clock: faClock,
  shieldCheck: faShield,

  // Problems
  fileQuestion: faFileCircleQuestion,
  layerGroup: faLayerGroup,
  triangleWarning: faTriangleExclamation,
  passport: faPassport,
  calendarXmark: faCalendarXmark,
  poorCommunication: faCommentsAlt,

  // Trust
  lock: faLock,
  userShield: faUserShield,
  folderLock: faFolder,
  scroll: faScroll,

  // Hero / nav
  arrowRight: faArrowRight,
  sparkles: faWandMagicSparkles,
  locationDot: faLocationDot,
  compass: faCompass,
  userGraduate: faUserGraduate,
  star: faStar,
  chevronDown: faChevronDown,
  globe: faGlobe,
  bars: faBars,
  xmark: faXmark,

  // Journey steps (Lead → Europe, 18 steps)
  lead: faPenToSquare,
  counselling: faCommentDots,
  registration: faUserPlus,
  profileAssessment: faListCheck,
  countrySelection: faMapLocationDot,
  universitySelection: faBuildingColumns,
  courseSelection: faBookOpen,
  documentCollection: faFolderOpen,
  universityApplication: faPaperPlane,
  offerLetter: faMailBulk,
  deposit: faCreditCard,
  visaPreparation: faPassportVisa,
  visaSubmission: faFileInvoice,
  biometrics: faFingerprint,
  interview: faMicrophone,
  visaDecision: faCircleCheck,
  travelPreparation: faSuitcaseRolling,
  europe: faEarthEurope,

  // How we help
  lightbulb: faLightbulb,
  route: faRoute,
  peopleArrows: faPeopleArrows,
  plane: faPlane,

  // Contact
  phone: faPhone,
  mail: faEnvelope,
  clockAlt: faClockAlt,
} as const;

/**
 * FaIcon — a thin wrapper around FontAwesomeIcon that accepts an
 * IconDefinition from the ICONS registry. Lets us write:
 *   <FaIcon icon={ICONS.comments} />
 * instead of:
 *   <FontAwesomeIcon icon={faComments} />
 */
export function FaIcon({
  icon,
  className,
  ...props
}: {
  icon: IconDefinition;
  className?: string;
} & React.ComponentProps<typeof FontAwesomeIcon>) {
  return <FontAwesomeIcon icon={icon} className={cn(className)} {...props} />;
}
