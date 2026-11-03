import type { Metadata } from 'next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faKey, faUser, faEnvelope, faLock, faEnvelopeCircleCheck, faShield,
  faCartShopping, faLightbulb, faCreditCard, faMagnifyingGlass,
  faIdCard, faGear, faLocationDot, faBox, faArrowRight, faFileImport,
} from '@fortawesome/free-solid-svg-icons';
import { THEME_TITLES } from '@/libs/config/showcase.config';

export const metadata: Metadata = {
  title: { absolute: THEME_TITLES.common },
};

const SECTIONS = [
  {
    id: 'auth',
    title: 'Authentication',
    tag: 'common/auth',
    pages: [
      { title: 'Login',            description: 'Email + password with OAuth providers and remember-me.',                 href: '/theme/common/auth/login',           icon: <FontAwesomeIcon icon={faKey} /> },
      { title: 'Register',         description: 'Account creation with password confirmation and OAuth shortcuts.',        href: '/theme/common/auth/register',        icon: <FontAwesomeIcon icon={faUser} /> },
      { title: 'Forgot Password',  description: 'Request a reset link via email.',                                        href: '/theme/common/auth/forgot-password',  icon: <FontAwesomeIcon icon={faEnvelope} /> },
      { title: 'Reset Password',   description: 'Set a new password after clicking the email link.',                      href: '/theme/common/auth/reset-password',   icon: <FontAwesomeIcon icon={faLock} /> },
      { title: 'Verify Email',     description: '6-digit OTP entry with countdown timer and paste support.',              href: '/theme/common/auth/verify-email',     icon: <FontAwesomeIcon icon={faEnvelopeCircleCheck} /> },
      { title: 'Two-Factor Auth',  description: 'Authenticator-app OTP code entry with recovery options.',               href: '/theme/common/auth/two-factor',       icon: <FontAwesomeIcon icon={faShield} /> },
    ],
  },
  {
    id: 'cart',
    title: 'Cart',
    tag: 'common/cart',
    pages: [
      { title: 'Shopping Cart',    description: 'Full cart with quantity controls, remove, coupon, and totals.',          href: '/theme/common/cart',                  icon: <FontAwesomeIcon icon={faCartShopping} /> },
    ],
  },
  {
    id: 'payment',
    title: 'Payment',
    tag: 'common/payment',
    pages: [
      { title: 'Payment Components', description: 'Showcase of all payment UI pieces.',                                  href: '/theme/common/payment',               icon: <FontAwesomeIcon icon={faLightbulb} /> },
      { title: 'Checkout',         description: '4-step flow: address → method → card → review.',                        href: '/theme/common/payment/checkout',      icon: <FontAwesomeIcon icon={faCreditCard} /> },
    ],
  },
  {
    id: 'utility',
    title: 'Utility',
    tag: 'common/utility',
    pages: [
      { title: 'Not Found (404)',  description: 'Full-page 404 with gradient icon, action buttons and decorative dots.', href: '/theme/common/not-found', icon: <FontAwesomeIcon icon={faMagnifyingGlass} /> },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    tag: 'common/user · common/address',
    pages: [
      { title: 'Profile',          description: 'View and edit display name, username, bio, avatar URL.',                href: '/theme/common/account/profile',       icon: <FontAwesomeIcon icon={faIdCard} /> },
      { title: 'Settings',         description: 'Theme, language, notification toggles and password change.',            href: '/theme/common/account/settings',      icon: <FontAwesomeIcon icon={faGear} /> },
      { title: 'Address Book',     description: 'Manage delivery addresses with full add / edit / delete.',               href: '/theme/common/account/addresses',     icon: <FontAwesomeIcon icon={faLocationDot} /> },
      { title: 'Payment Methods',  description: 'Saved cards: add, remove, set default.',                                href: '/theme/common/account/payment-methods', icon: <FontAwesomeIcon icon={faCreditCard} /> },
      { title: 'Order History',    description: 'Filterable list with inline payment detail and totals summary.',         href: '/theme/common/account/orders',        icon: <FontAwesomeIcon icon={faBox} /> },
    ],
  },
  {
    id: 'data',
    title: 'Data',
    tag: 'ui/ImportWizard',
    pages: [
      { title: 'Import from a file', description: 'CSV import wizard: map columns, check every row, import, undo, one-time downloads.', href: '/theme/common/imports', icon: <FontAwesomeIcon icon={faFileImport} /> },
    ],
  },
];

function PageCard({ title, description, href, icon }: { title: string; description: string; href: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-border bg-surface-raised p-4 hover:border-primary hover:shadow-md transition-all"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary text-lg">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">{title}</p>
        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{description}</p>
      </div>
      <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors shrink-0 mt-0.5" aria-hidden="true" />
    </a>
  );
}

export default function CommonThemePage() {
  const totalPages = SECTIONS.reduce((s, sec) => s + sec.pages.length, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 space-y-16">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-4 py-1.5 text-xs font-medium text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          modules/domains/common
        </div>
        <h1 className="text-4xl font-bold text-text-primary tracking-tight">Common Theme</h1>
        <p className="text-lg text-text-secondary max-w-xl mx-auto leading-relaxed">
          {totalPages} production-ready pages covering authentication, cart, payment, and account management.
        </p>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <section key={section.id} className="space-y-4" aria-labelledby={`${section.id}-heading`}>
          <div className="flex items-center gap-3">
            <h2 id={`${section.id}-heading`} className="text-xl font-semibold text-text-primary">
              {section.title}
            </h2>
            <div className="flex-1 h-px bg-border" aria-hidden="true" />
            <span className="text-xs text-text-secondary font-mono">{section.tag}</span>
          </div>
          <div className="grid gap-3">
            {section.pages.map((page) => (
              <PageCard key={page.href} {...page} />
            ))}
          </div>
        </section>
      ))}

      {/* Components used */}
      <section className="rounded-xl border border-border bg-surface-raised p-6 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">All components used</h2>
        <div className="flex flex-wrap gap-2">
          {[
            'LoginForm', 'RegisterForm', 'ForgotPasswordForm', 'ChangePasswordForm',
            'OAuthButtons', 'SessionExpiredBanner',
            'CartItem', 'CartSummary', 'CartBadge', 'CartPreview',
            'CreditCardForm', 'CreditCardVisual', 'PaymentMethodSelector',
            'SavedCardSelector', 'PaymentSummaryCard', 'PaymentStatusBadge',
            'OrderTotalsCard', 'CouponInput', 'PriceDisplay',
            'AddressCard', 'AddressForm', 'AddressSelector',
            'UserProfileCard', 'UserProfileForm', 'UserPreferencesForm',
            'UserAvatar', 'UserMenu', 'UserRoleBadge', 'UserStatusBadge',
            'LanguageSwitcher', 'CurrencySelector',
            'NotFoundPage',
          ].map((name) => (
            <span key={name} className="rounded-md bg-surface-overlay px-2.5 py-1 text-xs font-mono text-text-secondary">
              {name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
