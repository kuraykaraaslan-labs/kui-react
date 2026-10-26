'use client';
import { useState } from 'react';
import { LoginForm } from '@/modules/domains/common/auth/LoginForm';
import { RegisterForm } from '@/modules/domains/common/auth/RegisterForm';
import { OAuthButtons } from '@/modules/domains/common/auth/OAuthButtons';
import { UserAvatar } from '@/modules/domains/common/user/UserAvatar';
import { UserRoleBadge } from '@/modules/domains/common/user/UserRoleBadge';
import { UserStatusBadge } from '@/modules/domains/common/user/UserStatusBadge';
import { UserMenu } from '@/modules/domains/common/user/UserMenu';
import { PriceDisplay } from '@/modules/domains/common/money/PriceDisplay';
import { OrderTotalsCard } from '@/modules/domains/common/money/OrderTotalsCard';
import { PaymentStatusBadge } from '@/modules/domains/common/payment/PaymentStatusBadge';
import { AddressForm } from '@/modules/domains/common/address/AddressForm';
import { AddressCard } from '@/modules/domains/common/address/AddressCard';
import { PublishStatusBadge } from '@/modules/domains/common/status/PublishStatusBadge';
import { VisibilityBadge } from '@/modules/domains/common/status/VisibilityBadge';
import { LanguageSwitcher } from '@/modules/domains/common/i18n/LanguageSwitcher';
import { ChangePasswordForm } from '@/modules/domains/common/auth/ChangePasswordForm';
import { ForgotPasswordForm } from '@/modules/domains/common/auth/ForgotPasswordForm';
import { SessionExpiredBanner } from '@/modules/domains/common/auth/SessionExpiredBanner';
import { SeoForm } from '@/modules/domains/common/seo/SeoForm';
import { SeoPreview } from '@/modules/domains/common/seo/SeoPreview';
import { AddressSelector } from '@/modules/domains/common/address/AddressSelector';
import { LocationPicker } from '@/modules/domains/common/location/LocationPicker';
import { GeoPointDisplay } from '@/modules/domains/common/location/GeoPointDisplay';
import { ProcessingStatusIndicator } from '@/modules/domains/common/status/ProcessingStatusIndicator';
import { CurrencySelector } from '@/modules/domains/common/money/CurrencySelector';
import { CountrySelector } from '@/modules/domains/common/location/CountrySelector';
import { DirectionProvider } from '@/modules/domains/common/i18n/DirectionProvider';
import type { ProcessingStatus } from '@/modules/domains/common/BaseTypes';
import { UserProfileCard } from '@/modules/domains/common/user/UserProfileCard';
import { UserProfileForm } from '@/modules/domains/common/user/UserProfileForm';
import { UserPreferencesForm } from '@/modules/domains/common/user/UserPreferencesForm';
import { CouponInput } from '@/modules/domains/common/discount/CouponInput';
import { DiscountBadge } from '@/modules/domains/common/discount/DiscountBadge';
import { PaymentMethodSelector } from '@/modules/domains/common/payment/PaymentMethodSelector';
import { PaymentSummaryCard } from '@/modules/domains/common/payment/PaymentSummaryCard';
import { CreditCardVisual } from '@/modules/domains/common/payment/CreditCardVisual';
import { CreditCardForm } from '@/modules/domains/common/payment/CreditCardForm';
import { SavedCardSelector } from '@/modules/domains/common/payment/SavedCardSelector';
import { CheckoutSuccessState } from '@/modules/domains/common/payment/CheckoutSuccessState';
import { NotFoundPage } from '@/modules/app/NotFoundPage';
import { ChatBox } from '@/modules/domains/common/chat/ChatBox';
import { NotificationMenu, type NotificationItem } from '@/modules/domains/common/notification/NotificationMenu';
import { SubscriptionPlanCard, type SubscriptionPlan } from '@/modules/domains/common/subscription/SubscriptionPlanCard';
import {
  RevenueBarChart,
  UserActivityLineChart,
  SalesByCategoryDoughnut,
  ProductComparisonRadar,
  RegionalSalesPolar,
} from '@/modules/domains/common/charts/Charts';
import type { PaymentMethod, SavedCard } from '@/modules/domains/common/PaymentTypes';
import type { AppLanguage } from '@/modules/domains/common/I18nTypes';
import type { ShowcaseComponent } from '../showcase.types';

/* ─── demo users ─── */
const ADMIN_USER = {
  userId: 'u1',
  email: 'admin@acme.com',
  userRole: 'ADMIN' as const,
  userStatus: 'ACTIVE' as const,
  userProfile: { name: 'Jane Doe', profilePicture: null },
};

const AUTHOR_USER = {
  userId: 'u2',
  email: 'author@acme.com',
  userRole: 'AUTHOR' as const,
  userStatus: 'ACTIVE' as const,
  userProfile: { name: 'John Smith', profilePicture: null },
};

const USER_NO_PROFILE = {
  userId: 'u3',
  email: 'user@acme.com',
  userRole: 'USER' as const,
  userStatus: 'INACTIVE' as const,
};

/* ─── LoginForm ─── */
function LoginFormDefaultDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Sign In</h2>
      <LoginForm onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }} />
    </div>
  );
}

function LoginFormErrorDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Sign In</h2>
      <LoginForm error="Invalid email or password. Please try again." onSubmit={async () => {}} />
    </div>
  );
}

/* ─── RegisterForm ─── */
function RegisterFormDefaultDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Create Account</h2>
      <RegisterForm onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }} />
    </div>
  );
}

function RegisterFormErrorDemo() {
  const [error, setError] = useState('');
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Create Account</h2>
      <RegisterForm
        error={error || undefined}
        onSubmit={async () => { setError('This email address is already in use.'); }}
      />
    </div>
  );
}

/* ─── OAuthButtons ─── */
function OAuthButtonsAllDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg space-y-3">
      <p className="text-sm text-text-secondary text-center">Or continue with</p>
      <OAuthButtons onProvider={async (p) => { await new Promise((r) => setTimeout(r, 800)); console.log(p); }} />
    </div>
  );
}

function OAuthButtonsSelectDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg space-y-3">
      <p className="text-sm text-text-secondary text-center">Social sign-in</p>
      <OAuthButtons providers={['GOOGLE', 'GITHUB']} onProvider={() => {}} />
    </div>
  );
}

/* ─── UserAvatar ─── */
function UserAvatarSizesDemo() {
  return (
    <div className="flex items-end gap-4 flex-wrap p-4">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <div key={size} className="flex flex-col items-center gap-1">
          <UserAvatar user={ADMIN_USER} size={size} />
          <span className="text-xs text-text-secondary">{size}</span>
        </div>
      ))}
    </div>
  );
}

function UserAvatarStatusDemo() {
  return (
    <div className="flex items-center gap-6 p-4 flex-wrap">
      <div className="flex flex-col items-center gap-1">
        <UserAvatar user={ADMIN_USER} size="lg" status="online" />
        <span className="text-xs text-text-secondary">online</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <UserAvatar user={AUTHOR_USER} size="lg" status="away" />
        <span className="text-xs text-text-secondary">away</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <UserAvatar user={{ userId: 'u4', email: 'b@acme.com', userRole: 'USER', userStatus: 'ACTIVE', userProfile: { name: 'Alice Brown', profilePicture: null } }} size="lg" status="busy" />
        <span className="text-xs text-text-secondary">busy</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <UserAvatar user={USER_NO_PROFILE} size="lg" status="offline" />
        <span className="text-xs text-text-secondary">offline</span>
      </div>
    </div>
  );
}

/* ─── UserRoleBadge ─── */
function UserRoleBadgesDemo() {
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      <UserRoleBadge role="ADMIN" />
      <UserRoleBadge role="AUTHOR" />
      <UserRoleBadge role="USER" />
    </div>
  );
}

function UserRoleBadgeSizesDemo() {
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      <UserRoleBadge role="ADMIN" size="sm" />
      <UserRoleBadge role="ADMIN" size="md" />
      <UserRoleBadge role="ADMIN" size="lg" />
    </div>
  );
}

/* ─── UserStatusBadge ─── */
function UserStatusBadgesDemo() {
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      <UserStatusBadge status="ACTIVE" />
      <UserStatusBadge status="INACTIVE" />
      <UserStatusBadge status="BANNED" />
    </div>
  );
}

function UserStatusBadgeDotDemo() {
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      <UserStatusBadge status="ACTIVE" dot />
      <UserStatusBadge status="INACTIVE" dot />
      <UserStatusBadge status="BANNED" dot />
    </div>
  );
}

/* ─── UserMenu ─── */
function UserMenuAdminDemo() {
  return (
    <div className="flex items-center justify-center p-8">
      <UserMenu user={ADMIN_USER} />
    </div>
  );
}

function UserMenuCustomDemo() {
  return (
    <div className="flex items-center justify-center p-8">
      <UserMenu
        user={AUTHOR_USER}
        items={[
          { type: 'item', label: 'My Posts',  icon: '📝' },
          { type: 'item', label: 'Settings',  icon: '⚙️' },
          { type: 'separator' },
          { type: 'item', label: 'Sign Out',  icon: '↩️', danger: true },
        ]}
      />
    </div>
  );
}

function UserMenuContributedDemo() {
  return (
    <div className="flex items-center justify-center p-8">
      <UserMenu
        user={ADMIN_USER}
        profileHref="#profile"
        extraItems={[
          { id: 'dnd', label: 'Do not disturb', group: 'status', order: 10 },
          { id: 'preferences', label: 'Preferences' },
          { id: 'switch-tenant', label: 'Switch workspace', group: 'workspace', order: 600 },
          { id: 'stop-impersonating', label: 'Stop impersonating', group: 'session', order: 900, hidden: true },
        ]}
      />
    </div>
  );
}

function UserMenuSessionDemo() {
  return (
    <div className="flex items-center justify-center p-8">
      <UserMenu
        user={{ email: 'sam@acme.com', userProfile: { name: 'Sam Lee' } }}
        profileHref="#profile"
        signOutHref="#sign-out"
        mergeItems
        items={[{ id: 'settings', label: 'Settings', hidden: true }]}
        portal
      />
    </div>
  );
}

/* ─── PriceDisplay ─── */
function PriceDisplaySizesDemo() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <PriceDisplay amount={1299.99} currency="TRY" size="sm" />
      <PriceDisplay amount={1299.99} currency="TRY" size="md" />
      <PriceDisplay amount={1299.99} currency="TRY" size="lg" />
      <PriceDisplay amount={1299.99} currency="TRY" size="xl" />
    </div>
  );
}

function PriceDisplayCurrenciesDemo() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <PriceDisplay amount={2499} currency="TRY" size="lg" />
        <PriceDisplay amount={1799} currency="TRY" size="lg" strikethrough />
      </div>
      <PriceDisplay amount={89.99} currency="USD" locale="en-US" size="lg" />
      <PriceDisplay amount={74.99} currency="EUR" locale="de-DE" size="lg" />
    </div>
  );
}

/* ─── PaymentStatusBadge ─── */
function PaymentStatusBadgesDemo() {
  const statuses = ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'] as const;
  return (
    <div className="flex flex-wrap gap-3 p-4">
      {statuses.map((s) => <PaymentStatusBadge key={s} status={s} />)}
    </div>
  );
}

function PaymentStatusBadgeDotDemo() {
  const statuses = ['PENDING', 'PAID', 'FAILED'] as const;
  return (
    <div className="flex flex-wrap gap-3 p-4">
      {statuses.map((s) => <PaymentStatusBadge key={s} status={s} dot size="lg" />)}
    </div>
  );
}

/* ─── AddressForm ─── */
function AddressFormEmptyDemo() {
  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">New Address</h2>
      <AddressForm onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }} />
    </div>
  );
}

function AddressFormPrefilledDemo() {
  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Edit Address</h2>
      <AddressForm
        initial={{
          fullName: 'Jane Doe',
          phone: '+1 555 000 0000',
          addressLine1: '123 Main Street, Apt 4B',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'United States',
          countryCode: 'US',
        }}
        submitLabel="Update"
        onCancel={() => {}}
        onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }}
      />
    </div>
  );
}

/* ─── AddressCard ─── */
const DEMO_ADDRESS = {
  addressLine1: '123 Main Street, Apt 4B',
  addressLine2: 'Near Central Park',
  fullName: 'Jane Doe',
  phone: '+1 555 000 0000',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'United States',
  countryCode: 'US',
};

function AddressCardDefaultDemo() {
  return (
    <div className="w-full max-w-sm p-4">
      <AddressCard address={DEMO_ADDRESS} onEdit={() => {}} onDelete={() => {}} />
    </div>
  );
}

function AddressCardSelectedDemo() {
  const [selected, setSelected] = useState(0);
  const addresses = [
    DEMO_ADDRESS,
    { addressLine1: '456 Oak Avenue', city: 'Los Angeles', state: 'CA', postalCode: '90001', country: 'United States', countryCode: 'US', fullName: 'John Smith' },
  ];
  return (
    <div className="w-full max-w-sm p-4 space-y-3">
      {addresses.map((addr, i) => (
        <AddressCard key={i} address={addr} selected={selected === i} onEdit={() => setSelected(i)} />
      ))}
    </div>
  );
}

/* ─── OrderTotalsCard ─── */
function OrderTotalsCardBasicDemo() {
  return (
    <div className="w-full max-w-xs p-4">
      <OrderTotalsCard
        locale="en-US"
        totals={{ subtotal: 89.99, discountTotal: 0, taxTotal: 0, serviceFee: 0, shippingTotal: 0, total: 89.99, currency: 'USD' }}
      />
    </div>
  );
}

function OrderTotalsCardFullDemo() {
  return (
    <div className="w-full max-w-xs p-4">
      <OrderTotalsCard
        locale="en-US"
        totals={{ subtotal: 149.99, discountTotal: 20, taxTotal: 11.99, serviceFee: 2.99, shippingTotal: 9.99, total: 153.96, currency: 'USD' }}
      />
    </div>
  );
}

/* ─── PublishStatusBadge ─── */
function PublishStatusBadgesDemo() {
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      <PublishStatusBadge status="DRAFT" />
      <PublishStatusBadge status="PUBLISHED" />
      <PublishStatusBadge status="ARCHIVED" />
    </div>
  );
}

function PublishStatusBadgeNoIconDemo() {
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      <PublishStatusBadge status="DRAFT"     showIcon={false} size="sm" />
      <PublishStatusBadge status="PUBLISHED" showIcon={false} size="sm" />
      <PublishStatusBadge status="ARCHIVED"  showIcon={false} size="sm" />
    </div>
  );
}

/* ─── VisibilityBadge ─── */
function VisibilityBadgesDemo() {
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      <VisibilityBadge visibility="PUBLIC" />
      <VisibilityBadge visibility="PRIVATE" />
      <VisibilityBadge visibility="UNLISTED" />
    </div>
  );
}

function VisibilityBadgeSizesDemo() {
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      <VisibilityBadge visibility="PUBLIC" size="sm" />
      <VisibilityBadge visibility="PUBLIC" size="md" />
      <VisibilityBadge visibility="PUBLIC" size="lg" />
    </div>
  );
}

/* ─── LanguageSwitcher ─── */
const DEMO_LANGS = ['en', 'tr', 'de', 'fr', 'ar'] as AppLanguage[];

function LanguageSwitcherDefaultDemo() {
  const [lang, setLang] = useState<AppLanguage>('en' as AppLanguage);
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <LanguageSwitcher value={lang} onChange={setLang} languages={DEMO_LANGS} />
      <p className="text-xs text-text-secondary">Selected: <code className="font-mono">{lang}</code></p>
    </div>
  );
}

function LanguageSwitcherRTLDemo() {
  const [lang, setLang] = useState<AppLanguage>('ar' as AppLanguage);
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <LanguageSwitcher value={lang} onChange={setLang} languages={DEMO_LANGS} />
      <p className="text-xs text-text-secondary">RTL detected for: <code className="font-mono">{lang}</code></p>
    </div>
  );
}

/* ─── ChangePasswordForm ─── */
function ChangePasswordFormDefaultDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Change Password</h2>
      <ChangePasswordForm onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }} />
    </div>
  );
}

function ChangePasswordFormErrorDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Change Password</h2>
      <ChangePasswordForm error="Current password is incorrect." onSubmit={async () => {}} />
    </div>
  );
}

/* ─── UserProfileCard ─── */
function UserProfileCardFullDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <UserProfileCard
        user={{ ...ADMIN_USER, userProfile: { name: 'Jane Doe', username: 'janedoe', biography: 'Full-stack engineer. Loves design systems and coffee.', profilePicture: null } }}
        actions={<button className="text-xs text-primary border border-border rounded-md px-3 py-1 hover:bg-surface-overlay">Edit</button>}
      />
    </div>
  );
}

function UserProfileCardMinimalDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <UserProfileCard user={USER_NO_PROFILE} />
    </div>
  );
}

/* ─── UserProfileForm ─── */
function UserProfileFormEmptyDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Edit Profile</h2>
      <UserProfileForm onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }} />
    </div>
  );
}

function UserProfileFormPrefilledDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Edit Profile</h2>
      <UserProfileForm
        initial={{ name: 'Jane Doe', username: 'janedoe', biography: 'Full-stack engineer. Loves design systems.' }}
        onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }}
      />
    </div>
  );
}

/* ─── UserPreferencesForm ─── */
function UserPreferencesFormDefaultDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Preferences</h2>
      <UserPreferencesForm onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }} />
    </div>
  );
}

function UserPreferencesFormPrefilledDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Preferences</h2>
      <UserPreferencesForm
        initial={{ theme: 'DARK', language: 'tr', emailNotifications: false, newsletter: false }}
        onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }}
      />
    </div>
  );
}

/* ─── CouponInput ─── */
function CouponInputDefaultDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <p className="text-sm font-medium text-text-primary mb-3">Have a coupon?</p>
      <CouponInput
        onApply={async (code) => {
          await new Promise((r) => setTimeout(r, 600));
          return code === 'SAVE20' ? { success: true, message: '20% discount applied!' } : { success: false, message: 'Invalid coupon code.' };
        }}
      />
      <p className="text-xs text-text-secondary mt-2">Try: <code className="font-mono">SAVE20</code></p>
    </div>
  );
}

function CouponInputAppliedDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <p className="text-sm font-medium text-text-primary mb-3">Have a coupon?</p>
      <CouponInput appliedCode="SAVE20" onApply={async () => ({ success: true })} onRemove={() => {}} />
    </div>
  );
}

/* ─── DiscountBadge ─── */
function DiscountBadgeTypesDemo() {
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      <DiscountBadge discountType="PERCENTAGE" discountValue={20} />
      <DiscountBadge discountType="FIXED" discountValue={50} currency="TRY" />
      <DiscountBadge discountType="FREE_SHIPPING" discountValue={0} />
    </div>
  );
}

function DiscountBadgeSizesDemo() {
  return (
    <div className="flex items-center gap-3 p-4 flex-wrap">
      <DiscountBadge discountType="PERCENTAGE" discountValue={10} size="sm" />
      <DiscountBadge discountType="PERCENTAGE" discountValue={10} size="md" />
      <DiscountBadge discountType="PERCENTAGE" discountValue={10} size="lg" />
    </div>
  );
}

/* ─── PaymentMethodSelector ─── */
function PaymentMethodSelectorDefaultDemo() {
  const [method, setMethod] = useState<PaymentMethod>('CREDIT_CARD');
  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <PaymentMethodSelector value={method} onChange={setMethod} />
    </div>
  );
}


/* ─── PaymentSummaryCard ─── */
function PaymentSummaryCardPaidDemo() {
  return (
    <div className="w-full max-w-xs mx-auto p-4">
      <PaymentSummaryCard
        payment={{ paymentId: 'pay_001', provider: 'Stripe', providerPaymentId: 'pi_3Nf9xZ2eZvKYlo2C', method: 'CREDIT_CARD', status: 'PAID', amount: 153.96, currency: 'USD' }}
      />
    </div>
  );
}

function PaymentSummaryCardPendingDemo() {
  return (
    <div className="w-full max-w-xs mx-auto p-4">
      <PaymentSummaryCard
        payment={{ paymentId: 'pay_002', provider: 'Iyzico', method: 'BANK_TRANSFER', status: 'PENDING', amount: 2499, currency: 'TRY' }}
      />
    </div>
  );
}

/* ─── builder ─── */
export function buildCommonDomainData(): ShowcaseComponent[] {
  return [
    {
      id: 'common-login-form',
      title: 'LoginForm',
      category: 'Domain',
      abbr: 'LF',
      description: 'Email + password sign-in form with inline validation, "Remember me" checkbox, and server-error banner.',
      filePath: 'modules/domains/common/auth/LoginForm.tsx',
      sourceCode: `'use client';
import { LoginForm } from '@/modules/domains/common/auth/LoginForm';

<LoginForm
  onSubmit={async ({ email, password, rememberMe }) => {
    await signIn(email, password);
  }}
  error="Invalid email or password."
/>`,
      variants: [
        { title: 'Default', layout: 'stack', preview: <LoginFormDefaultDemo />, code: `<LoginForm onSubmit={handleLogin} />` },
        { title: 'Server error', layout: 'stack', preview: <LoginFormErrorDemo />, code: `<LoginForm onSubmit={handleLogin} error="Invalid email or password." />` },
      ],
    },
    {
      id: 'common-register-form',
      title: 'RegisterForm',
      category: 'Domain',
      abbr: 'RF',
      description: 'Registration form with email, password, and confirm-password fields. Real-time password match validation and server-error support.',
      filePath: 'modules/domains/common/auth/RegisterForm.tsx',
      sourceCode: `'use client';
import { RegisterForm } from '@/modules/domains/common/auth/RegisterForm';

<RegisterForm
  onSubmit={async ({ email, password }) => {
    await register(email, password);
  }}
/>`,
      variants: [
        { title: 'Default', layout: 'stack', preview: <RegisterFormDefaultDemo />, code: `<RegisterForm onSubmit={handleRegister} />` },
        { title: 'Server error', layout: 'stack', preview: <RegisterFormErrorDemo />, code: `<RegisterForm onSubmit={handleRegister} error="This email is already in use." />` },
      ],
    },
    {
      id: 'common-oauth-buttons',
      title: 'OAuthButtons',
      category: 'Domain',
      abbr: 'OA',
      description: 'Social sign-in buttons for Google, GitHub, Discord, and Microsoft. Accepts a providers prop to show only a subset.',
      filePath: 'modules/domains/common/auth/OAuthButtons.tsx',
      sourceCode: `'use client';
import { OAuthButtons } from '@/modules/domains/common/auth/OAuthButtons';

// All providers
<OAuthButtons onProvider={(provider) => signInWithOAuth(provider)} />

// Selected providers
<OAuthButtons providers={['GOOGLE', 'GITHUB']} onProvider={handleOAuth} />`,
      variants: [
        { title: 'All providers', layout: 'stack', preview: <OAuthButtonsAllDemo />, code: `<OAuthButtons onProvider={handleOAuth} />` },
        { title: 'Selected providers', layout: 'stack', preview: <OAuthButtonsSelectDemo />, code: `<OAuthButtons providers={['GOOGLE', 'GITHUB']} onProvider={handleOAuth} />` },
      ],
    },
    {
      id: 'common-user-avatar',
      title: 'UserAvatar',
      category: 'Domain',
      abbr: 'UA',
      description: 'Avatar that consumes the SafeUser type. Falls back to initials when no profile picture is set; supports online/away/busy/offline status dots.',
      filePath: 'modules/domains/common/user/UserAvatar.tsx',
      sourceCode: `'use client';
import { UserAvatar } from '@/modules/domains/common/user/UserAvatar';

<UserAvatar user={currentUser} size="md" status="online" />`,
      variants: [
        { title: 'Sizes', preview: <UserAvatarSizesDemo />, code: `<UserAvatar user={user} size="xs" />\n<UserAvatar user={user} size="sm" />\n<UserAvatar user={user} size="md" />\n<UserAvatar user={user} size="lg" />\n<UserAvatar user={user} size="xl" />` },
        { title: 'Status indicators', preview: <UserAvatarStatusDemo />, code: `<UserAvatar user={user} size="lg" status="online" />\n<UserAvatar user={user} size="lg" status="away" />\n<UserAvatar user={user} size="lg" status="busy" />\n<UserAvatar user={user} size="lg" status="offline" />` },
      ],
    },
    {
      id: 'common-user-role-badge',
      title: 'UserRoleBadge',
      category: 'Domain',
      abbr: 'RB',
      description: 'Color-coded badge for ADMIN / AUTHOR / USER roles. ADMIN renders as error (red), AUTHOR as primary (blue), USER as neutral.',
      filePath: 'modules/domains/common/user/UserRoleBadge.tsx',
      sourceCode: `'use client';
import { UserRoleBadge } from '@/modules/domains/common/user/UserRoleBadge';

<UserRoleBadge role="ADMIN" />
<UserRoleBadge role="AUTHOR" size="sm" />`,
      variants: [
        { title: 'All roles', preview: <UserRoleBadgesDemo />, code: `<UserRoleBadge role="ADMIN" />\n<UserRoleBadge role="AUTHOR" />\n<UserRoleBadge role="USER" />` },
        { title: 'Sizes', preview: <UserRoleBadgeSizesDemo />, code: `<UserRoleBadge role="ADMIN" size="sm" />\n<UserRoleBadge role="ADMIN" size="md" />\n<UserRoleBadge role="ADMIN" size="lg" />` },
      ],
    },
    {
      id: 'common-user-status-badge',
      title: 'UserStatusBadge',
      category: 'Domain',
      abbr: 'SB',
      description: 'Color-coded badge for ACTIVE / INACTIVE / BANNED user statuses. Optional dot prop adds a leading status indicator.',
      filePath: 'modules/domains/common/user/UserStatusBadge.tsx',
      sourceCode: `'use client';
import { UserStatusBadge } from '@/modules/domains/common/user/UserStatusBadge';

<UserStatusBadge status="ACTIVE" />
<UserStatusBadge status="BANNED" dot />`,
      variants: [
        { title: 'All statuses', preview: <UserStatusBadgesDemo />, code: `<UserStatusBadge status="ACTIVE" />\n<UserStatusBadge status="INACTIVE" />\n<UserStatusBadge status="BANNED" />` },
        { title: 'With dot', preview: <UserStatusBadgeDotDemo />, code: `<UserStatusBadge status="ACTIVE" dot />\n<UserStatusBadge status="INACTIVE" dot />\n<UserStatusBadge status="BANNED" dot />` },
      ],
    },
    {
      id: 'common-user-menu',
      title: 'UserMenu',
      category: 'Domain',
      abbr: 'UM',
      description: 'Avatar + name + role trigger (the role line only when the user has one); the chevron turns over while the menu is open. Dropdown with Profile, Settings, and Sign out items (hrefs, handlers and labels configurable). `extraItems` (or `items` + `mergeItems`) merge contributed items with the defaults, placed by group and order; a hidden item with a built-in id leaves that item out. `user` takes a SafeUser or just an email, an optional role and a profile. `portal` renders the open menu in document.body so a sticky or clipping top bar cannot cut it off. Closes on outside click and Escape.',
      filePath: 'modules/domains/common/user/UserMenu.tsx',
      sourceCode: `'use client';
import { UserMenu } from '@/modules/domains/common/user/UserMenu';

<UserMenu user={currentUser} align="right" />`,
      variants: [
        { title: 'Admin user', preview: <UserMenuAdminDemo />, code: `<UserMenu user={{ userId: 'u1', email: 'admin@acme.com', userRole: 'ADMIN', userStatus: 'ACTIVE', userProfile: { name: 'Jane Doe', profilePicture: null } }} />` },
        { title: 'Custom items', preview: <UserMenuCustomDemo />, code: `<UserMenu user={authorUser} items={[\n  { type: 'item', label: 'My Posts', icon: '📝' },\n  { type: 'separator' },\n  { type: 'item', label: 'Sign Out', icon: '↩️', danger: true },\n]} />` },
        { title: 'Contributed items (merged)', preview: <UserMenuContributedDemo />, code: `// extraItems merge with Profile / Settings / Sign out instead of replacing them.\n// No group: joins the account items. No order: after them, before sign out (order 1000).\n<UserMenu\n  user={currentUser}\n  profileHref="/me"\n  onSignOut={signOut}\n  extraItems={[\n    { id: 'dnd', label: 'Do not disturb', group: 'status', order: 10 },\n    { id: 'preferences', label: 'Preferences' },\n    { id: 'switch-tenant', label: 'Switch workspace', group: 'workspace', order: 600 },\n    { id: 'stop-impersonating', label: 'Stop impersonating', group: 'session', order: 900, hidden: !impersonating },\n  ]}\n/>` },
        { title: 'Session user, no Settings, in a portal', preview: <UserMenuSessionDemo />, code: `// A session user (email + profile, no role): the trigger shows the name alone.\n// A hidden item with a built-in id leaves Settings out; portal opens the menu in\n// document.body so a sticky top bar cannot clip it.\n<UserMenu\n  user={{ email: 'sam@acme.com', userProfile: { name: 'Sam Lee' } }}\n  profileHref="/me"\n  signOutHref="/logout"\n  mergeItems\n  items={[{ id: 'settings', label: 'Settings', hidden: true }]}\n  portal\n/>` },
      ],
    },
    {
      id: 'common-price-display',
      title: 'PriceDisplay',
      category: 'Domain',
      abbr: 'PD',
      description: 'Currency formatter using Intl.NumberFormat. Supports any ISO 4217 code and locale. Strikethrough prop renders an original/crossed-out price.',
      filePath: 'modules/domains/common/money/PriceDisplay.tsx',
      sourceCode: `'use client';
import { PriceDisplay } from '@/modules/domains/common/money/PriceDisplay';

<PriceDisplay amount={1299.99} currency="USD" size="lg" />
<PriceDisplay amount={1799} currency="USD" size="lg" strikethrough />`,
      variants: [
        { title: 'Sizes', preview: <PriceDisplaySizesDemo />, code: `<PriceDisplay amount={1299.99} currency="USD" size="sm" />\n<PriceDisplay amount={1299.99} currency="USD" size="md" />\n<PriceDisplay amount={1299.99} currency="USD" size="lg" />\n<PriceDisplay amount={1299.99} currency="USD" size="xl" />` },
        { title: 'Multi-currency + strikethrough', preview: <PriceDisplayCurrenciesDemo />, code: `<PriceDisplay amount={2499} currency="TRY" size="lg" />\n<PriceDisplay amount={1799} currency="TRY" size="lg" strikethrough />\n<PriceDisplay amount={89.99} currency="USD" locale="en-US" size="lg" />\n<PriceDisplay amount={74.99} currency="EUR" locale="de-DE" size="lg" />` },
      ],
    },
    {
      id: 'common-payment-status-badge',
      title: 'PaymentStatusBadge',
      category: 'Domain',
      abbr: 'PS',
      description: 'Color-coded badge for all PaymentStatus values: PENDING / AUTHORIZED / PAID / FAILED / CANCELLED / REFUNDED.',
      filePath: 'modules/domains/common/payment/PaymentStatusBadge.tsx',
      sourceCode: `'use client';
import { PaymentStatusBadge } from '@/modules/domains/common/payment/PaymentStatusBadge';

<PaymentStatusBadge status="PAID" />
<PaymentStatusBadge status="PENDING" dot size="lg" />`,
      variants: [
        { title: 'All statuses', preview: <PaymentStatusBadgesDemo />, code: `<PaymentStatusBadge status="PENDING" />\n<PaymentStatusBadge status="AUTHORIZED" />\n<PaymentStatusBadge status="PAID" />\n<PaymentStatusBadge status="FAILED" />\n<PaymentStatusBadge status="CANCELLED" />\n<PaymentStatusBadge status="REFUNDED" />` },
        { title: 'With dot, large', preview: <PaymentStatusBadgeDotDemo />, code: `<PaymentStatusBadge status="PENDING" dot size="lg" />\n<PaymentStatusBadge status="PAID" dot size="lg" />\n<PaymentStatusBadge status="FAILED" dot size="lg" />` },
      ],
    },
    {
      id: 'common-address-form',
      title: 'AddressForm',
      category: 'Domain',
      abbr: 'AF',
      description: 'Full address form with full name, phone, address lines, city, state/district, postal code, and country. Pre-fillable via the initial prop.',
      filePath: 'modules/domains/common/address/AddressForm.tsx',
      sourceCode: `'use client';
import { AddressForm } from '@/modules/domains/common/address/AddressForm';

<AddressForm
  initial={{ fullName: 'Jane Doe', city: 'New York', country: 'United States' }}
  onSubmit={async (values) => saveAddress(values)}
  onCancel={() => setOpen(false)}
/>`,
      variants: [
        { title: 'Empty', layout: 'stack', preview: <AddressFormEmptyDemo />, code: `<AddressForm onSubmit={handleSave} />` },
        { title: 'Pre-filled', layout: 'stack', preview: <AddressFormPrefilledDemo />, code: `<AddressForm initial={existingAddress} submitLabel="Update" onCancel={handleCancel} onSubmit={handleUpdate} />` },
      ],
    },
    {
      id: 'common-address-card',
      title: 'AddressCard',
      category: 'Domain',
      abbr: 'AC',
      description: 'Read-only address display card with full name, phone, address lines, city, state, postal code, and country. Supports selected state and optional Edit/Delete actions.',
      filePath: 'modules/domains/common/address/AddressCard.tsx',
      sourceCode: `'use client';
import { AddressCard } from '@/modules/domains/common/address/AddressCard';

<AddressCard
  address={savedAddress}
  selected={selectedId === address.id}
  onEdit={() => openEditModal(address)}
  onDelete={() => deleteAddress(address.id)}
/>`,
      variants: [
        { title: 'Default', preview: <AddressCardDefaultDemo />, code: `<AddressCard address={address} onEdit={handleEdit} onDelete={handleDelete} />` },
        { title: 'Selectable list', preview: <AddressCardSelectedDemo />, code: `<AddressCard address={address} selected={selected === idx} onEdit={() => setSelected(idx)} />` },
      ],
    },
    {
      id: 'common-order-totals-card',
      title: 'OrderTotalsCard',
      category: 'Domain',
      abbr: 'OT',
      description: 'Order summary card showing subtotal, discount, tax, service fee, shipping, and an emphasized total. Zero-value lines are hidden automatically.',
      filePath: 'modules/domains/common/money/OrderTotalsCard.tsx',
      sourceCode: `'use client';
import { OrderTotalsCard } from '@/modules/domains/common/money/OrderTotalsCard';

<OrderTotalsCard
  currency="USD"
  locale="en-US"
  totals={{ subtotal: 149.99, discountTotal: 20, taxTotal: 11.99, shippingTotal: 9.99, total: 153.96 }}
/>`,
      variants: [
        { title: 'No extras', preview: <OrderTotalsCardBasicDemo />, code: `<OrderTotalsCard currency="USD" totals={{ subtotal: 89.99, total: 89.99 }} />` },
        { title: 'With discount, tax & shipping', preview: <OrderTotalsCardFullDemo />, code: `<OrderTotalsCard currency="USD" totals={{ subtotal: 149.99, discountTotal: 20, taxTotal: 11.99, shippingTotal: 9.99, total: 153.96 }} />` },
      ],
    },
    {
      id: 'common-publish-status-badge',
      title: 'PublishStatusBadge',
      category: 'Domain',
      abbr: 'PB',
      description: 'Badge for DRAFT / PUBLISHED / ARCHIVED content states with contextual Font Awesome icons. Icon can be hidden via showIcon={false}.',
      filePath: 'modules/domains/common/status/PublishStatusBadge.tsx',
      sourceCode: `'use client';
import { PublishStatusBadge } from '@/modules/domains/common/status/PublishStatusBadge';

<PublishStatusBadge status="PUBLISHED" />
<PublishStatusBadge status="DRAFT" showIcon={false} size="sm" />`,
      variants: [
        { title: 'All statuses', preview: <PublishStatusBadgesDemo />, code: `<PublishStatusBadge status="DRAFT" />\n<PublishStatusBadge status="PUBLISHED" />\n<PublishStatusBadge status="ARCHIVED" />` },
        { title: 'Without icon, small', preview: <PublishStatusBadgeNoIconDemo />, code: `<PublishStatusBadge status="DRAFT" showIcon={false} size="sm" />\n<PublishStatusBadge status="PUBLISHED" showIcon={false} size="sm" />` },
      ],
    },
    {
      id: 'common-visibility-badge',
      title: 'VisibilityBadge',
      category: 'Domain',
      abbr: 'VB',
      description: 'Badge for PUBLIC / PRIVATE / UNLISTED visibility states with eye/lock icons. PUBLIC is green, PRIVATE is red, UNLISTED is neutral.',
      filePath: 'modules/domains/common/status/VisibilityBadge.tsx',
      sourceCode: `'use client';
import { VisibilityBadge } from '@/modules/domains/common/status/VisibilityBadge';

<VisibilityBadge visibility="PUBLIC" />
<VisibilityBadge visibility="PRIVATE" size="sm" />`,
      variants: [
        { title: 'All states', preview: <VisibilityBadgesDemo />, code: `<VisibilityBadge visibility="PUBLIC" />\n<VisibilityBadge visibility="PRIVATE" />\n<VisibilityBadge visibility="UNLISTED" />` },
        { title: 'Sizes', preview: <VisibilityBadgeSizesDemo />, code: `<VisibilityBadge visibility="PUBLIC" size="sm" />\n<VisibilityBadge visibility="PUBLIC" size="md" />\n<VisibilityBadge visibility="PUBLIC" size="lg" />` },
      ],
    },
    {
      id: 'common-language-switcher',
      title: 'LanguageSwitcher',
      category: 'Domain',
      abbr: 'LS',
      description: 'Dropdown language selector using AppLanguage, LANG_NAMES and LANG_FLAGS from I18nTypes. RTL direction is applied per-option automatically.',
      filePath: 'modules/domains/common/i18n/LanguageSwitcher.tsx',
      sourceCode: `'use client';
import { LanguageSwitcher } from '@/modules/domains/common/i18n/LanguageSwitcher';

// Controlled — driven by AVAILABLE_LANGUAGES from env
<LanguageSwitcher value={lang} onChange={setLang} />

// Explicit list
<LanguageSwitcher
  value={lang}
  onChange={setLang}
  languages={['en', 'tr', 'de', 'fr', 'ar']}
/>`,
      variants: [
        { title: 'Default', preview: <LanguageSwitcherDefaultDemo />, code: `<LanguageSwitcher value={lang} onChange={setLang} languages={['en', 'tr', 'de', 'fr']} />` },
        { title: 'RTL selected', preview: <LanguageSwitcherRTLDemo />, code: `<LanguageSwitcher value="ar" onChange={setLang} languages={['en', 'tr', 'de', 'fr', 'ar']} />` },
      ],
    },
    {
      id: 'common-change-password-form',
      title: 'ChangePasswordForm',
      category: 'Domain',
      abbr: 'CP',
      description: 'Current password + new password + confirm fields with match validation and server-error banner.',
      filePath: 'modules/domains/common/auth/ChangePasswordForm.tsx',
      sourceCode: `'use client';
import { ChangePasswordForm } from '@/modules/domains/common/auth/ChangePasswordForm';

<ChangePasswordForm
  onSubmit={async ({ currentPassword, newPassword }) => {
    await updatePassword(currentPassword, newPassword);
  }}
  error={serverError}
/>`,
      variants: [
        { title: 'Default', layout: 'stack' as const, preview: <ChangePasswordFormDefaultDemo />, code: `<ChangePasswordForm onSubmit={handleSubmit} />` },
        { title: 'Server error', layout: 'stack' as const, preview: <ChangePasswordFormErrorDemo />, code: `<ChangePasswordForm onSubmit={handleSubmit} error="Current password is incorrect." />` },
      ],
    },
    {
      id: 'common-user-profile-card',
      title: 'UserProfileCard',
      category: 'Domain',
      abbr: 'PC',
      description: 'Profile card with cover banner, avatar, display name, username, bio, role and status badges, and an optional actions slot.',
      filePath: 'modules/domains/common/user/UserProfileCard.tsx',
      sourceCode: `'use client';
import { UserProfileCard } from '@/modules/domains/common/user/UserProfileCard';

<UserProfileCard
  user={currentUser}
  actions={<Button variant="outline" size="sm">Edit</Button>}
/>`,
      variants: [
        { title: 'Full profile', layout: 'stack' as const, preview: <UserProfileCardFullDemo />, code: `<UserProfileCard user={user} actions={<Button variant="outline" size="sm">Edit</Button>} />` },
        { title: 'No profile data', preview: <UserProfileCardMinimalDemo />, code: `<UserProfileCard user={user} />` },
      ],
    },
    {
      id: 'common-user-profile-form',
      title: 'UserProfileForm',
      category: 'Domain',
      abbr: 'PF',
      description: 'Controlled form for editing display name, username, bio, and profile picture URL. Username validation: 3–32 chars, lowercase alphanumeric + underscore.',
      filePath: 'modules/domains/common/user/UserProfileForm.tsx',
      sourceCode: `'use client';
import { UserProfileForm } from '@/modules/domains/common/user/UserProfileForm';

<UserProfileForm
  initial={{ name: 'Jane Doe', username: 'janedoe' }}
  onSubmit={async (values) => saveProfile(values)}
/>`,
      variants: [
        { title: 'Empty', layout: 'stack' as const, preview: <UserProfileFormEmptyDemo />, code: `<UserProfileForm onSubmit={handleSave} />` },
        { title: 'Pre-filled', layout: 'stack' as const, preview: <UserProfileFormPrefilledDemo />, code: `<UserProfileForm initial={{ name: 'Jane Doe', username: 'janedoe', biography: '...' }} onSubmit={handleSave} />` },
      ],
    },
    {
      id: 'common-user-preferences-form',
      title: 'UserPreferencesForm',
      category: 'Domain',
      abbr: 'UP',
      description: 'Preferences form with theme and language selects plus email/push notification and newsletter toggles.',
      filePath: 'modules/domains/common/user/UserPreferencesForm.tsx',
      sourceCode: `'use client';
import { UserPreferencesForm } from '@/modules/domains/common/user/UserPreferencesForm';

<UserPreferencesForm
  initial={currentUser.userPreferences}
  onSubmit={async (prefs) => savePreferences(prefs)}
/>`,
      variants: [
        { title: 'Defaults', layout: 'stack' as const, preview: <UserPreferencesFormDefaultDemo />, code: `<UserPreferencesForm onSubmit={handleSave} />` },
        { title: 'Pre-filled', layout: 'stack' as const, preview: <UserPreferencesFormPrefilledDemo />, code: `<UserPreferencesForm initial={{ theme: 'DARK', language: 'tr', emailNotifications: false }} onSubmit={handleSave} />` },
      ],
    },
    {
      id: 'common-coupon-input',
      title: 'CouponInput',
      category: 'Domain',
      abbr: 'CI',
      description: 'Coupon code input with apply/remove flow. Calls onApply which returns success/error; shows applied state once a valid code is accepted.',
      filePath: 'modules/domains/common/discount/CouponInput.tsx',
      sourceCode: `'use client';
import { CouponInput } from '@/modules/domains/common/discount/CouponInput';

<CouponInput
  onApply={async (code) => {
    const result = await validateCoupon(code);
    return { success: result.valid, message: result.message };
  }}
  appliedCode={appliedCoupon}
  onRemove={() => setAppliedCoupon(undefined)}
/>`,
      variants: [
        { title: 'Default (try SAVE20)', layout: 'stack' as const, preview: <CouponInputDefaultDemo />, code: `<CouponInput onApply={async (code) => validateCoupon(code)} />` },
        { title: 'Applied state', layout: 'stack' as const, preview: <CouponInputAppliedDemo />, code: `<CouponInput appliedCode="SAVE20" onApply={handleApply} onRemove={handleRemove} />` },
      ],
    },
    {
      id: 'common-discount-badge',
      title: 'DiscountBadge',
      category: 'Domain',
      abbr: 'DB',
      description: 'Formats and displays a discount: percentage (e.g. "20% off"), fixed amount with currency, or free shipping.',
      filePath: 'modules/domains/common/discount/DiscountBadge.tsx',
      sourceCode: `'use client';
import { DiscountBadge } from '@/modules/domains/common/discount/DiscountBadge';

<DiscountBadge discountType="PERCENTAGE" discountValue={20} />
<DiscountBadge discountType="FIXED" discountValue={50} currency="TRY" />
<DiscountBadge discountType="FREE_SHIPPING" discountValue={0} />`,
      variants: [
        { title: 'All types', preview: <DiscountBadgeTypesDemo />, code: `<DiscountBadge discountType="PERCENTAGE" discountValue={20} />\n<DiscountBadge discountType="FIXED" discountValue={50} currency="TRY" />\n<DiscountBadge discountType="FREE_SHIPPING" discountValue={0} />` },
        { title: 'Sizes', preview: <DiscountBadgeSizesDemo />, code: `<DiscountBadge discountType="PERCENTAGE" discountValue={10} size="sm" />\n<DiscountBadge discountType="PERCENTAGE" discountValue={10} size="md" />\n<DiscountBadge discountType="PERCENTAGE" discountValue={10} size="lg" />` },
      ],
    },
    {
      id: 'common-payment-method-selector',
      title: 'PaymentMethodSelector',
      category: 'Domain',
      abbr: 'PM',
      description: 'Radio-group style card selector for payment methods. Shows icon, label, and description. Default set: credit card, debit card, bank transfer, wallet.',
      filePath: 'modules/domains/common/payment/PaymentMethodSelector.tsx',
      sourceCode: `'use client';
import { PaymentMethodSelector } from '@/modules/domains/common/payment/PaymentMethodSelector';

const [method, setMethod] = useState<PaymentMethod>('CREDIT_CARD');

<PaymentMethodSelector value={method} onChange={setMethod} />`,
      variants: [
        { title: 'Default (4 methods)', layout: 'stack' as const, preview: <PaymentMethodSelectorDefaultDemo />, code: `<PaymentMethodSelector value={method} onChange={setMethod} />` },
      ],
    },
    {
      id: 'common-payment-summary-card',
      title: 'PaymentSummaryCard',
      category: 'Domain',
      abbr: 'SC',
      description: 'Read-only payment summary card: amount, method, provider, provider reference, and status badge.',
      filePath: 'modules/domains/common/payment/PaymentSummaryCard.tsx',
      sourceCode: `'use client';
import { PaymentSummaryCard } from '@/modules/domains/common/payment/PaymentSummaryCard';

<PaymentSummaryCard payment={order.payment} />`,
      variants: [
        { title: 'Paid via Stripe', preview: <PaymentSummaryCardPaidDemo />, code: `<PaymentSummaryCard payment={{ provider: 'Stripe', method: 'CREDIT_CARD', status: 'PAID', amount: 153.96, currency: 'USD', ... }} />` },
        { title: 'Pending bank transfer', preview: <PaymentSummaryCardPendingDemo />, code: `<PaymentSummaryCard payment={{ provider: 'Iyzico', method: 'BANK_TRANSFER', status: 'PENDING', amount: 2499, currency: 'TRY', ... }} />` },
      ],
    },
    {
      id: 'common-forgot-password-form',
      title: 'ForgotPasswordForm',
      category: 'Domain',
      abbr: 'FP',
      description: 'Email input that triggers a password reset link. Shows an inline success state after submission instead of a redirect.',
      filePath: 'modules/domains/common/auth/ForgotPasswordForm.tsx',
      sourceCode: `<ForgotPasswordForm onSubmit={async (email) => sendResetLink(email)} />`,
      variants: [
        { title: 'Default', layout: 'stack' as const, preview: <ForgotPasswordFormDefaultDemo />, code: `<ForgotPasswordForm onSubmit={async (email) => sendResetLink(email)} />` },
        { title: 'Sent state', layout: 'stack' as const, preview: <ForgotPasswordFormSentDemo />, code: `// After successful onSubmit, form renders a success message automatically` },
      ],
    },
    {
      id: 'common-session-expired-banner',
      title: 'SessionExpiredBanner',
      category: 'Domain',
      abbr: 'SE',
      description: 'Warning banner shown when the user session has expired. Includes a "Sign in again" action button.',
      filePath: 'modules/domains/common/auth/SessionExpiredBanner.tsx',
      sourceCode: `<SessionExpiredBanner onSignIn={() => router.push('/login')} />`,
      variants: [
        { title: 'With action', layout: 'stack' as const, preview: <SessionExpiredBannerDefaultDemo />, code: `<SessionExpiredBanner onSignIn={() => router.push('/login')} />` },
        { title: 'Custom message', layout: 'stack' as const, preview: <SessionExpiredBannerCustomDemo />, code: `<SessionExpiredBanner message="You've been signed out due to inactivity." onSignIn={handleSignIn} />` },
      ],
    },
    {
      id: 'common-seo-form',
      title: 'SeoForm',
      category: 'Domain',
      abbr: 'SF',
      description: 'SEO metadata form: title (60 char limit), meta description (160 char limit), and keyword tag input with character counters.',
      filePath: 'modules/domains/common/seo/SeoForm.tsx',
      sourceCode: `<SeoForm
  initial={{ seoTitle: 'My Page', seoDescription: 'Description…', keywords: ['next', 'react'] }}
  onSubmit={async (seo) => saveSeo(seo)}
  onCancel={() => setEditing(false)}
/>`,
      variants: [
        { title: 'Empty', layout: 'stack' as const, preview: <SeoFormEmptyDemo />, code: `<SeoForm onSubmit={handleSave} />` },
        { title: 'Pre-filled', layout: 'stack' as const, preview: <SeoFormPrefilledDemo />, code: `<SeoForm initial={{ seoTitle: 'My Page', seoDescription: 'Short desc', keywords: ['next', 'react'] }} onSubmit={handleSave} onCancel={handleCancel} />` },
      ],
    },
    {
      id: 'common-seo-preview',
      title: 'SeoPreview',
      category: 'Domain',
      abbr: 'SP',
      description: 'Google search result preview card. Shows title, URL, and description with character count indicators. Empty fields render placeholder text.',
      filePath: 'modules/domains/common/seo/SeoPreview.tsx',
      sourceCode: `<SeoPreview
  seo={{ seoTitle: 'My Page', seoDescription: 'Description…', keywords: ['next'] }}
  url="https://example.com/my-page"
  siteName="Example"
/>`,
      variants: [
        { title: 'Filled', layout: 'stack' as const, preview: <SeoPreviewFilledDemo />, code: `<SeoPreview seo={{ seoTitle: 'My Page Title', seoDescription: 'A clear meta description.', keywords: ['next', 'react'] }} url="https://example.com/page" />` },
        { title: 'Empty (placeholders)', layout: 'stack' as const, preview: <SeoPreviewEmptyDemo />, code: `<SeoPreview seo={{}} url="https://example.com/page" />` },
      ],
    },
    {
      id: 'common-address-selector',
      title: 'AddressSelector',
      category: 'Domain',
      abbr: 'AS',
      description: 'Selectable list of saved addresses built on AddressCard. Supports add, edit, and delete callbacks.',
      filePath: 'modules/domains/common/address/AddressSelector.tsx',
      sourceCode: `<AddressSelector
  addresses={savedAddresses}
  selectedIndex={selectedIdx}
  onSelect={(i, addr) => setSelected(i)}
  onAdd={() => setShowAddForm(true)}
  onEdit={(i, addr) => openEditModal(addr)}
  onDelete={(i) => deleteAddress(i)}
/>`,
      variants: [
        { title: 'Multiple addresses', layout: 'stack' as const, preview: <AddressSelectorDemo />, code: `<AddressSelector addresses={addresses} onSelect={handleSelect} onAdd={handleAdd} />` },
        { title: 'Empty state', layout: 'stack' as const, preview: <AddressSelectorEmptyDemo />, code: `<AddressSelector addresses={[]} onSelect={handleSelect} onAdd={() => setShowForm(true)} />` },
      ],
    },
    {
      id: 'common-location-picker',
      title: 'LocationPicker',
      category: 'Domain',
      abbr: 'LP',
      description: 'Location form with country selector (countries-list), city, state, postal code, and optional lat/lng. 2-column grid layout.',
      filePath: 'modules/domains/common/location/LocationPicker.tsx',
      sourceCode: `<LocationPicker
  initial={{ city: 'Istanbul', countryCode: 'TR' }}
  onSubmit={async (loc) => saveLocation(loc)}
/>`,
      variants: [
        { title: 'Empty', layout: 'stack' as const, preview: <LocationPickerEmptyDemo />, code: `<LocationPicker onSubmit={handleSave} />` },
        { title: 'Pre-filled', layout: 'stack' as const, preview: <LocationPickerPrefilledDemo />, code: `<LocationPicker initial={{ city: 'Istanbul', countryCode: 'TR', postalCode: '34000' }} onSubmit={handleSave} onCancel={handleCancel} />` },
      ],
    },
    {
      id: 'common-geo-point-display',
      title: 'GeoPointDisplay',
      category: 'Domain',
      abbr: 'GP',
      description: 'Displays latitude/longitude coordinates with a Google Maps link. Configurable precision and optional label.',
      filePath: 'modules/domains/common/location/GeoPointDisplay.tsx',
      sourceCode: `<GeoPointDisplay point={{ latitude: 41.0082, longitude: 28.9784 }} label="Istanbul" />`,
      variants: [
        { title: 'With label', preview: <GeoPointDisplayLabelDemo />, code: `<GeoPointDisplay point={{ latitude: 41.0082, longitude: 28.9784 }} label="Istanbul" />` },
        { title: 'Coordinates only', preview: <GeoPointDisplayMinimalDemo />, code: `<GeoPointDisplay point={{ latitude: 48.8566, longitude: 2.3522 }} showMapLink={false} />` },
      ],
    },
    {
      id: 'common-processing-status-indicator',
      title: 'ProcessingStatusIndicator',
      category: 'Domain',
      abbr: 'PI',
      description: 'Animated status indicator for UPLOADING / PROCESSING / READY / FAILED states. Optional progress bar with percentage.',
      filePath: 'modules/domains/common/status/ProcessingStatusIndicator.tsx',
      sourceCode: `<ProcessingStatusIndicator status="PROCESSING" progress={45} label="Encoding video…" />`,
      variants: [
        { title: 'All states', preview: <ProcessingStatusAllDemo />, code: `<ProcessingStatusIndicator status="UPLOADING" progress={30} />\n<ProcessingStatusIndicator status="PROCESSING" progress={65} />\n<ProcessingStatusIndicator status="READY" progress={100} />\n<ProcessingStatusIndicator status="FAILED" />` },
        { title: 'Custom label + sizes', preview: <ProcessingStatusSizesDemo />, code: `<ProcessingStatusIndicator status="PROCESSING" label="Encoding…" progress={45} size="sm" />\n<ProcessingStatusIndicator status="PROCESSING" label="Encoding…" progress={45} size="md" />\n<ProcessingStatusIndicator status="PROCESSING" label="Encoding…" progress={45} size="lg" />` },
      ],
    },
    {
      id: 'common-currency-selector',
      title: 'CurrencySelector',
      category: 'Domain',
      abbr: 'CS',
      description: 'Currency dropdown built from countries-list. Deduped, alphabetically sorted ISO 4217 currency codes.',
      filePath: 'modules/domains/common/money/CurrencySelector.tsx',
      sourceCode: `const [currency, setCurrency] = useState('TRY');\n\n<CurrencySelector value={currency} onChange={setCurrency} />`,
      variants: [
        { title: 'Default', preview: <CurrencySelectorDemo />, code: `<CurrencySelector value={currency} onChange={setCurrency} />` },
        { title: 'No label', preview: <CurrencySelectorNoLabelDemo />, code: `<CurrencySelector value="USD" onChange={setCurrency} label="" />` },
      ],
    },
    {
      id: 'common-country-selector',
      title: 'CountrySelector',
      category: 'Domain',
      abbr: 'Co',
      description: 'Country dropdown built from countries-list. Shows flag + full name + ISO2 code. Supports search by name or code, error/hint states.',
      filePath: 'modules/domains/common/location/CountrySelector.tsx',
      sourceCode: `const [country, setCountry] = useState('TR');\n\n<CountrySelector value={country} onChange={setCountry} />`,
      variants: [
        { title: 'Default', preview: <CountrySelectorDemo />, code: `<CountrySelector value={country} onChange={setCountry} />` },
        { title: 'With hint & error', preview: <CountrySelectorStatesDemo />, code: `<CountrySelector value="" onChange={setCountry} hint="Used for shipping address." />\n<CountrySelector value="" onChange={setCountry} error="Please select a country." required />` },
        { title: 'No label', preview: <CountrySelectorNoLabelDemo />, code: `<CountrySelector value="US" onChange={setCountry} label="" />` },
      ],
    },
    {
      id: 'common-direction-provider',
      title: 'DirectionProvider',
      category: 'Domain',
      abbr: 'DP',
      description: 'Context provider that sets dir="rtl"/"ltr" on a wrapper div based on the active language. useDirection() hook exposes lang, dir, isRTL.',
      filePath: 'modules/domains/common/i18n/DirectionProvider.tsx',
      sourceCode: `<DirectionProvider lang={currentLang}>
  {/* all children inherit correct text direction */}
  <p>مرحبا بالعالم</p>
</DirectionProvider>`,
      variants: [
        { title: 'RTL (Arabic)', layout: 'stack' as const, preview: <DirectionProviderRTLDemo />, code: `<DirectionProvider lang="ar">\n  <p className="text-right">مرحبا بالعالم — Hello World</p>\n</DirectionProvider>` },
        { title: 'LTR (English)', layout: 'stack' as const, preview: <DirectionProviderLTRDemo />, code: `<DirectionProvider lang="en">\n  <p>Hello World — مرحبا بالعالم</p>\n</DirectionProvider>` },
      ],
    },
    {
      id: 'common-credit-card-visual',
      title: 'CreditCardVisual',
      category: 'Domain',
      abbr: 'CV',
      description: 'Animated 3-D flip credit card. Front shows number, name, expiry; back shows CVV strip. Supports VISA, Mastercard, AMEX, Discover.',
      filePath: 'modules/domains/common/payment/CreditCardVisual.tsx',
      sourceCode: `<CreditCardVisual
  brand="VISA"
  cardNumber="4111111111111111"
  cardholderName="JANE DOE"
  expiryMonth="08"
  expiryYear="28"
  flipped={cvvFocused}
/>`,
      variants: [
        { title: 'Brands', preview: <CreditCardVisualBrandsDemo />, code: `<CreditCardVisual brand="VISA" cardNumber="4111111111111111" cardholderName="JANE DOE" expiryMonth="08" expiryYear="28" />\n<CreditCardVisual brand="MASTERCARD" cardNumber="5500005555555559" cardholderName="JOHN SMITH" expiryMonth="12" expiryYear="27" />` },
        { title: 'Flipped (CVV)', preview: <CreditCardVisualFlippedDemo />, code: `<CreditCardVisual brand="AMEX" cardNumber="378282246310005" cardholderName="JANE DOE" expiryMonth="03" expiryYear="26" cvv="1234" flipped />` },
      ],
    },
    {
      id: 'common-credit-card-form',
      title: 'CreditCardForm',
      category: 'Domain',
      abbr: 'CF',
      description: 'Full credit card entry form with live card visual preview. Auto-detects brand, formats number, flips card on CVV focus, validates expiry.',
      filePath: 'modules/domains/common/payment/CreditCardForm.tsx',
      sourceCode: `<CreditCardForm
  onSubmit={async (card) => saveCard(card)}
  onCancel={() => setOpen(false)}
/>`,
      variants: [
        { title: 'Default', layout: 'stack' as const, preview: <CreditCardFormDemo />, code: `<CreditCardForm onSubmit={async (card) => saveCard(card)} onCancel={handleCancel} />` },
        { title: 'Server error', layout: 'stack' as const, preview: <CreditCardFormErrorDemo />, code: `<CreditCardForm onSubmit={handleSave} error="Card declined. Please try a different card." />` },
      ],
    },
    {
      id: 'common-saved-card-selector',
      title: 'SavedCardSelector',
      category: 'Domain',
      abbr: 'SC',
      description: 'Radio-group list of saved payment cards. Shows brand badge, masked number, expiry, and default indicator. Supports remove and add-new callbacks.',
      filePath: 'modules/domains/common/payment/SavedCardSelector.tsx',
      sourceCode: `<SavedCardSelector
  cards={savedCards}
  selectedCardId={selected}
  onSelect={(id, card) => setSelected(id)}
  onRemove={(id) => deleteCard(id)}
  onAddNew={() => setShowForm(true)}
/>`,
      variants: [
        { title: 'Multiple cards', layout: 'stack' as const, preview: <SavedCardSelectorDemo />, code: `<SavedCardSelector cards={cards} selectedCardId={selected} onSelect={handleSelect} onRemove={handleRemove} onAddNew={() => setShowForm(true)} />` },
        { title: 'Empty state', layout: 'stack' as const, preview: <SavedCardSelectorEmptyDemo />, code: `<SavedCardSelector cards={[]} onSelect={handleSelect} onAddNew={() => setShowForm(true)} />` },
      ],
    },
    {
      id: 'common-not-found-page',
      title: 'NotFoundPage',
      category: 'Domain',
      abbr: 'NF',
      description: 'Full-page 404 screen with a gradient "404" heading, icon slot, title, description, and home/back action buttons.',
      filePath: 'modules/app/NotFoundPage.tsx',
      sourceCode: `'use client';
import { NotFoundPage } from '@/modules/app/NotFoundPage';

<NotFoundPage
  title="Page Not Found"
  description="The page you are looking for does not exist."
  homeHref="/"
  homeLabel="Go Home"
  backLabel="Go Back"
/>`,
      variants: [
        { title: 'Default (Turkish)', layout: 'stack' as const, preview: <NotFoundPageDefaultDemo />, code: `<NotFoundPage homeHref="/" />` },
        { title: 'Custom copy', layout: 'stack' as const, preview: <NotFoundPageCustomDemo />, code: `<NotFoundPage title="Resource Not Found" description="The item you are looking for has been removed." homeLabel="Go Home" backLabel="Go Back" homeHref="/" />` },
      ],
    },
    {
      id: 'common-chat-box',
      title: 'ChatBox',
      category: 'Domain',
      abbr: 'CB',
      description: 'Floating chat widget that anchors to the bottom-right of the screen. Includes a FAB toggle, collapsible panel, scrollable message list with typing indicator, and an auto-growing textarea input.',
      filePath: 'modules/domains/common/chat/ChatBox.tsx',
      sourceCode: `'use client';
import { ChatBox } from '@/modules/domains/common/chat/ChatBox';

// Renders fixed at bottom-right of the page
<ChatBox
  title="Support Chat"
  subtitle="We typically reply in a few minutes"
  placeholder="Type a message…"
  onSend={async (text) => {
    // return agent reply string
    return 'Thanks for reaching out!';
  }}
/>`,
      variants: [
        {
          title: 'With initial messages',
          layout: 'stack' as const,
          preview: <ChatBoxDefaultDemo />,
          code: `<ChatBox
  title="Support Chat"
  subtitle="We typically reply in a few minutes"
  initialMessages={[
    { id: 'm1', role: 'agent', text: 'Hi there! How can I help you today?' },
    { id: 'm2', role: 'user', text: 'I have a question about my order.' },
  ]}
/>`,
        },
        {
          title: 'Empty / initial state',
          layout: 'stack' as const,
          preview: <ChatBoxEmptyDemo />,
          code: `<ChatBox title="Sales Chat" subtitle="Ask us anything" />`,
        },
      ],
    },
    {
      id: 'common-notification-menu',
      title: 'NotificationMenu',
      category: 'Domain',
      abbr: 'NM',
      description: 'Bell icon button with unread count badge. Opens a dropdown panel with one list: the notifications and the items of every other source (`sources`, the IoT alarms say) newest first, each with its colour dot or its own icon, a line under the title, a relative time in `locale` and an optional inline action. A filter All / <source> / Notifications appears with sources; "Mark all read" and each source\'s action (Acknowledge all) show where they apply, and the footer links to each page there is. An item with `href` is a link (a modified click opens a new tab) whose plain click runs `onClick`, so the host opens it inside the app and marks it read. `sections` still puts content above the list and `extraCount` adds to the badge. The panel stays inside the visible screen on a phone.',
      filePath: 'modules/domains/common/notification/NotificationMenu.tsx',
      sourceCode: `'use client';
import { NotificationMenu } from '@/modules/domains/common/notification/NotificationMenu';

const [items, setItems] = useState(initialNotifications);

<NotificationMenu
  items={items}
  onMarkAllRead={() => setItems((prev) => prev.map((n) => ({ ...n, read: true })))}
  onViewAll={() => router.push('/notifications')}
/>`,
      variants: [
        {
          title: 'With unread notifications',
          preview: <NotificationMenuWithItemsDemo />,
          code: `<NotificationMenu
  items={[
    { id: 'n1', title: 'New comment on your post', description: 'Jane replied to your article.', timestamp: '2 min ago', read: false, variant: 'info' },
    { id: 'n2', title: 'Payment received', description: 'Invoice #1042 paid ($153.96).', timestamp: '1 hr ago', read: false, variant: 'success' },
    { id: 'n3', title: 'Storage limit at 90%', timestamp: '3 hr ago', read: false, variant: 'warning' },
    { id: 'n4', title: 'Deployment complete', timestamp: 'Yesterday', read: true, variant: 'success' },
  ]}
  onMarkAllRead={handleMarkAllRead}
  onViewAll={() => router.push('/notifications')}
/>`,
        },
        {
          title: 'Empty state',
          preview: <NotificationMenuEmptyDemo />,
          code: `<NotificationMenu items={[]} onViewAll={() => router.push('/notifications')} />`,
        },
        {
          title: 'One list with another source (alarms)',
          preview: <NotificationMenuSourcesDemo />,
          code: `<NotificationMenu
  items={notifications}
  sources={[{
    key: 'alarms',
    label: 'Alarms',
    unread: openAlarms,
    items: alarms.map((a) => ({ id: a.id, title: a.title, meta: a.device, at: a.openedAt, read: a.acknowledged, icon: <SeverityIcon level={a.severity} />, href: \`/alarms/\${a.id}\`, onClick: () => router.push(\`/alarms/\${a.id}\`), action: { label: 'Acknowledge', onClick: () => acknowledge(a) } })),
    action: { label: \`Acknowledge all (\${openAlarms})\`, onClick: confirmAcknowledgeAll },
    viewAll: { label: 'View all alarms', href: '/alarms' },
  }]}
  onMarkAllRead={markAllRead}
/>`,
        },
      ],
    },
    {
      id: 'common-subscription-plan-card',
      title: 'SubscriptionPlanCard',
      category: 'Domain',
      abbr: 'SP',
      description: 'Subscription plan card displaying name, price with currency formatting, billing interval, and feature list with checkmarks. Highlights the popular and current plans. Accepts onSelect callback for plan switching.',
      filePath: 'modules/domains/common/subscription/SubscriptionPlanCard.tsx',
      sourceCode: `'use client';
import { SubscriptionPlanCard } from '@/modules/domains/common/subscription/SubscriptionPlanCard';

<SubscriptionPlanCard
  plan={{
    planId: 'pro',
    name: 'Pro',
    price: 1900,
    currency: 'USD',
    interval: 'MONTHLY',
    features: ['Unlimited projects', '10 team members', 'Priority support'],
    isPopular: true,
  }}
  onSelect={(planId) => handleUpgrade(planId)}
/>`,
      variants: [
        {
          title: 'Plan grid',
          layout: 'stack' as const,
          preview: <SubscriptionPlanGridDemo />,
          code: `<div className="grid grid-cols-3 gap-4">
  <SubscriptionPlanCard plan={freePlan} onSelect={handleSelect} />
  <SubscriptionPlanCard plan={proPlan} isCurrent onSelect={handleSelect} />
  <SubscriptionPlanCard plan={enterprisePlan} onSelect={handleSelect} />
</div>`,
        },
        {
          title: 'Single card states',
          layout: 'stack' as const,
          preview: <SubscriptionPlanStatesDemo />,
          code: `<SubscriptionPlanCard plan={plan} isCurrent />
<SubscriptionPlanCard plan={{ ...plan, isPopular: true }} onSelect={handleSelect} />`,
        },
      ],
    },
    /* ─── Charts ─── */
    {
      id: 'common-charts',
      title: 'Charts',
      category: 'Domain',
      abbr: 'Ch',
      description: 'react-chartjs-2 chart components wrapped in Cards: Bar, Line, Doughnut, Radar, and Polar Area.',
      filePath: 'modules/domains/common/charts/Charts.tsx',
      sourceCode: `import {
  RevenueBarChart,
  UserActivityLineChart,
  SalesByCategoryDoughnut,
  ProductComparisonRadar,
  RegionalSalesPolar,
} from '@/modules/domains/common/charts/Charts';

<RevenueBarChart />
<UserActivityLineChart />
<SalesByCategoryDoughnut />
<ProductComparisonRadar />
<RegionalSalesPolar />`,
      variants: [
        {
          title: 'Bar — Revenue vs Expenses',
          layout: 'stack' as const,
          preview: <RevenueBarChart />,
          code: `<RevenueBarChart />`,
        },
        {
          title: 'Line — User Activity',
          layout: 'stack' as const,
          preview: <UserActivityLineChart />,
          code: `<UserActivityLineChart />`,
        },
        {
          title: 'Doughnut — Sales by Category',
          layout: 'stack' as const,
          preview: <SalesByCategoryDoughnut />,
          code: `<SalesByCategoryDoughnut />`,
        },
        {
          title: 'Radar — Product Comparison',
          layout: 'stack' as const,
          preview: <ProductComparisonRadar />,
          code: `<ProductComparisonRadar />`,
        },
        {
          title: 'Polar Area — Regional Sales',
          layout: 'stack' as const,
          preview: <RegionalSalesPolar />,
          code: `<RegionalSalesPolar />`,
        },
      ],
    },

    {
      id: 'common-checkout-success-state',
      title: 'CheckoutSuccessState',
      category: 'Domain',
      abbr: 'CK',
      description: 'Success screen shown after checkout completion; includes a confirmation icon, payment summary, and optional delivery address.',
      filePath: 'modules/domains/common/payment/CheckoutSuccessState.tsx',
      sourceCode: `import { CheckoutSuccessState } from '@/modules/domains/common/payment/CheckoutSuccessState';

<CheckoutSuccessState
  payment={payment}
  address={deliveryAddress}
  onReset={() => window.location.reload()}
/>`,
      variants: [
        {
          title: 'Başarı ekranı',
          layout: 'stack' as const,
          preview: (
            <CheckoutSuccessState
              payment={{
                paymentId: 'pay_demo_001',
                provider: 'Stripe',
                providerPaymentId: 'pi_3NxYz2EwLHMpEt9Q1',
                method: 'CREDIT_CARD',
                status: 'PAID',
                amount: 1299.90,
                currency: 'TRY',
              }}
              onReset={() => {}}
            />
          ),
          code: `<CheckoutSuccessState
  payment={payment}
  address={deliveryAddress}
  onReset={() => window.location.reload()}
/>`,
        },
      ],
    },
  ];
}

/* ─── P3 demo components ─── */

function ForgotPasswordFormDefaultDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Forgot Password</h2>
      <ForgotPasswordForm onSubmit={async () => { await new Promise((r) => setTimeout(r, 800)); }} />
    </div>
  );
}

function ForgotPasswordFormSentDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Forgot Password</h2>
      <ForgotPasswordForm onSubmit={async () => {}} />
    </div>
  );
}

function SessionExpiredBannerDefaultDemo() {
  return <div className="w-full p-4"><SessionExpiredBanner onSignIn={() => {}} /></div>;
}

function SessionExpiredBannerCustomDemo() {
  return (
    <div className="w-full p-4">
      <SessionExpiredBanner message="You've been signed out due to inactivity." onSignIn={() => {}} />
    </div>
  );
}

function SeoFormEmptyDemo() {
  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <SeoForm onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }} />
    </div>
  );
}

function SeoFormPrefilledDemo() {
  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <SeoForm
        initial={{ seoTitle: 'Best Running Shoes 2025', seoDescription: 'Discover the top-rated running shoes for every terrain and budget.', keywords: ['running', 'shoes', 'sports'] }}
        onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }}
        onCancel={() => {}}
      />
    </div>
  );
}

function SeoPreviewFilledDemo() {
  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <SeoPreview
        seo={{ seoTitle: 'Best Running Shoes 2025', seoDescription: 'Discover the top-rated running shoes for every terrain and budget. Free shipping on orders over $50.', keywords: ['running', 'shoes'] }}
        url="https://shop.example.com/running-shoes"
        siteName="Shop Example"
      />
    </div>
  );
}

function SeoPreviewEmptyDemo() {
  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <SeoPreview seo={{}} url="https://example.com/page" />
    </div>
  );
}

const DEMO_ADDRESSES = [
  { addressLine1: '123 Main Street, Apt 4B', fullName: 'Jane Doe', phone: '+1 555 000 0000', city: 'New York', state: 'NY', postalCode: '10001', country: 'United States', countryCode: 'US' },
  { addressLine1: '456 Oak Avenue', fullName: 'Jane Doe', city: 'Los Angeles', state: 'CA', postalCode: '90001', country: 'United States', countryCode: 'US' },
];

function AddressSelectorDemo() {
  const [sel, setSel] = useState(0);
  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <AddressSelector addresses={DEMO_ADDRESSES} selectedIndex={sel} onSelect={(i) => setSel(i)} onAdd={() => {}} />
    </div>
  );
}

function AddressSelectorEmptyDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <AddressSelector addresses={[]} onSelect={() => {}} onAdd={() => {}} />
    </div>
  );
}

function LocationPickerEmptyDemo() {
  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <LocationPicker onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }} />
    </div>
  );
}

function LocationPickerPrefilledDemo() {
  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-surface-raised border border-border rounded-lg">
      <LocationPicker
        initial={{ city: 'Istanbul', countryCode: 'TR', postalCode: '34000', latitude: 41.0082, longitude: 28.9784 }}
        onSubmit={async (v) => { await new Promise((r) => setTimeout(r, 800)); console.log(v); }}
        onCancel={() => {}}
      />
    </div>
  );
}

function GeoPointDisplayLabelDemo() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <GeoPointDisplay point={{ latitude: 41.0082, longitude: 28.9784 }} label="Istanbul" />
      <GeoPointDisplay point={{ latitude: 48.8566, longitude: 2.3522  }} label="Paris" />
      <GeoPointDisplay point={{ latitude: 40.7128, longitude: -74.006 }} label="New York" />
    </div>
  );
}

function GeoPointDisplayMinimalDemo() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <GeoPointDisplay point={{ latitude: 51.5074, longitude: -0.1278 }} showMapLink={false} precision={4} />
    </div>
  );
}

function ProcessingStatusAllDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-4 space-y-4">
      {(['UPLOADING', 'PROCESSING', 'READY', 'FAILED'] as ProcessingStatus[]).map((s) => (
        <ProcessingStatusIndicator key={s} status={s} progress={s === 'READY' ? 100 : s === 'FAILED' ? undefined : 45} />
      ))}
    </div>
  );
}

function ProcessingStatusSizesDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-4 space-y-4">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <ProcessingStatusIndicator key={size} status="PROCESSING" label="Encoding video…" progress={65} size={size} />
      ))}
    </div>
  );
}

function CurrencySelectorDemo() {
  const [currency, setCurrency] = useState('TRY');
  return (
    <div className="w-full max-w-xs mx-auto p-4">
      <CurrencySelector value={currency} onChange={setCurrency} />
      <p className="text-xs text-text-secondary mt-2">Selected: <span className="font-mono">{currency}</span></p>
    </div>
  );
}

function CurrencySelectorNoLabelDemo() {
  const [currency, setCurrency] = useState('USD');
  return (
    <div className="w-full max-w-xs mx-auto p-4">
      <CurrencySelector value={currency} onChange={setCurrency} label="" />
    </div>
  );
}

function DirectionProviderRTLDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <DirectionProvider lang={'ar' as AppLanguage}>
        <div className="space-y-2 p-4 bg-surface-raised border border-border rounded-lg">
          <p className="text-sm font-semibold text-text-primary">dir=&quot;rtl&quot;</p>
          <p className="text-sm text-text-secondary">مرحبا بالعالم — Hello World</p>
          <p className="text-xs text-text-disabled">Text flows right to left</p>
        </div>
      </DirectionProvider>
    </div>
  );
}

function DirectionProviderLTRDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <DirectionProvider lang={'en' as AppLanguage}>
        <div className="space-y-2 p-4 bg-surface-raised border border-border rounded-lg">
          <p className="text-sm font-semibold text-text-primary">dir=&quot;ltr&quot;</p>
          <p className="text-sm text-text-secondary">Hello World — مرحبا بالعالم</p>
          <p className="text-xs text-text-disabled">Text flows left to right</p>
        </div>
      </DirectionProvider>
    </div>
  );
}

/* ─── CreditCardVisual demos ─── */

function CreditCardVisualBrandsDemo() {
  return (
    <div className="flex flex-wrap gap-4 justify-center p-4">
      <CreditCardVisual brand="VISA" cardNumber="4111111111111111" cardholderName="JANE DOE" expiryMonth="08" expiryYear="28" />
      <CreditCardVisual brand="MASTERCARD" cardNumber="5500005555555559" cardholderName="JOHN SMITH" expiryMonth="12" expiryYear="27" />
    </div>
  );
}

function CreditCardVisualFlippedDemo() {
  return (
    <div className="flex flex-wrap gap-4 justify-center p-4">
      <CreditCardVisual brand="AMEX" cardNumber="378282246310005" cardholderName="JANE DOE" expiryMonth="03" expiryYear="26" cvv="1234" flipped />
      <CreditCardVisual brand="DISCOVER" cardNumber="6011111111111117" cardholderName="BOB LEE" expiryMonth="09" expiryYear="29" cvv="123" />
    </div>
  );
}

/* ─── CreditCardForm demos ─── */

function CreditCardFormDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-4 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Add Payment Card</h2>
      <CreditCardForm onSubmit={async () => { await new Promise((r) => setTimeout(r, 800)); }} onCancel={() => {}} />
    </div>
  );
}

function CreditCardFormErrorDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-4 bg-surface-raised border border-border rounded-lg">
      <h2 className="text-base font-semibold text-text-primary mb-4">Add Payment Card</h2>
      <CreditCardForm error="Card declined. Please try a different card." onSubmit={async () => {}} />
    </div>
  );
}

/* ─── NotFoundPage demos ─── */

function NotFoundPageDefaultDemo() {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border" style={{ height: 340 }}>
      <div className="scale-[0.55] origin-top-left" style={{ width: '182%', height: '182%' }}>
        <NotFoundPage
          className="min-h-0 py-10"
          homeHref="#"
        />
      </div>
    </div>
  );
}

function NotFoundPageCustomDemo() {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border" style={{ height: 340 }}>
      <div className="scale-[0.55] origin-top-left" style={{ width: '182%', height: '182%' }}>
        <NotFoundPage
          className="min-h-0 py-10"
          title="Resource Not Found"
          description="The item you are looking for has been removed or does not exist."
          homeLabel="Go Home"
          backLabel="Go Back"
          homeHref="#"
        />
      </div>
    </div>
  );
}

/* ─── SavedCardSelector demos ─── */

const DEMO_CARDS: SavedCard[] = [
  { cardId: 'c1', last4: '4242', brand: 'VISA', cardholderName: 'Jane Doe', expiryMonth: '08', expiryYear: '28', isDefault: true },
  { cardId: 'c2', last4: '5559', brand: 'MASTERCARD', cardholderName: 'Jane Doe', expiryMonth: '12', expiryYear: '27' },
  { cardId: 'c3', last4: '0005', brand: 'AMEX', cardholderName: 'Jane Doe', expiryMonth: '03', expiryYear: '26' },
];

function SavedCardSelectorDemo() {
  const [selected, setSelected] = useState('c1');
  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <SavedCardSelector
        cards={DEMO_CARDS}
        selectedCardId={selected}
        onSelect={(id) => setSelected(id)}
        onRemove={() => {}}
        onAddNew={() => {}}
      />
    </div>
  );
}

function SavedCardSelectorEmptyDemo() {
  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <SavedCardSelector cards={[]} onSelect={() => {}} onAddNew={() => {}} />
    </div>
  );
}

/* ─── ChatBox demos ─── */

function ChatBoxDefaultDemo() {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-surface-raised" style={{ height: 520 }}>
      <div className="absolute inset-0 flex items-end justify-end p-2 pointer-events-none opacity-30 select-none">
        <span className="text-xs text-text-secondary italic">Live preview — fixed position on real pages</span>
      </div>
      <ChatBox
        title="Support Chat"
        subtitle="We typically reply in a few minutes"
        initialMessages={[
          { id: 'm1', role: 'agent', text: 'Hi there! How can I help you today?', timestamp: '09:00' },
          { id: 'm2', role: 'user', text: 'I have a question about my order.', timestamp: '09:01' },
          { id: 'm3', role: 'agent', text: 'Sure! Please share your order number and I\'ll look it up for you.', timestamp: '09:01' },
        ]}
        className="absolute bottom-4 right-4"
      />
    </div>
  );
}

function ChatBoxEmptyDemo() {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-surface-raised" style={{ height: 400 }}>
      <ChatBox
        title="Sales Chat"
        subtitle="Ask us anything"
        className="absolute bottom-4 right-4"
      />
    </div>
  );
}

/* ─── NotificationMenu demos ─── */

const DEMO_NOTIFICATION_ITEMS: NotificationItem[] = [
  { id: 'n1', title: 'New comment on your post', description: 'Jane replied to your article "Getting started with Next.js".', timestamp: '2 min ago', read: false, variant: 'info' },
  { id: 'n2', title: 'Payment received', description: 'Invoice #1042 has been paid ($153.96).', timestamp: '1 hr ago', read: false, variant: 'success' },
  { id: 'n3', title: 'Storage limit at 90%', description: 'You are using 9 GB of your 10 GB plan.', timestamp: '3 hr ago', read: false, variant: 'warning' },
  { id: 'n4', title: 'Deployment complete', description: 'v2.4.1 deployed to production successfully.', timestamp: 'Yesterday', read: true, variant: 'success' },
];

function NotificationMenuWithItemsDemo() {
  const [items, setItems] = useState(DEMO_NOTIFICATION_ITEMS);
  return (
    <div className="flex items-start justify-center pt-4 pb-72">
      <NotificationMenu
        items={items}
        onMarkAllRead={() => setItems((prev) => prev.map((n) => ({ ...n, read: true })))}
        onViewAll={() => {}}
      />
    </div>
  );
}

function NotificationMenuSourcesDemo() {
  const [items, setItems] = useState(DEMO_NOTIFICATION_ITEMS.map((n, i) => ({ ...n, timestamp: undefined, at: new Date(Date.UTC(2026, 9, 26, 12) - [2, 60, 180, 1_440][i] * 60_000) })));
  const [acked, setAcked] = useState<string[]>([]);
  const alarmItems = [
    { id: 'a1', title: 'Discharge pressure high', meta: 'Pump 4 · Plant A', minutes: 5 },
    { id: 'a2', title: 'Device offline', meta: 'Gateway 2 · Plant B', minutes: 95 },
  ].map((a) => ({
    id: a.id,
    title: a.title,
    meta: a.meta,
    at: new Date(Date.UTC(2026, 9, 26, 12) - a.minutes * 60_000),
    read: acked.includes(a.id),
    icon: <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-text-inverse" aria-label="Critical">!</span>,
    href: '#alarm',
    action: acked.includes(a.id) ? undefined : { label: 'Acknowledge', onClick: () => setAcked((x) => [...x, a.id]) },
  }));
  const open = alarmItems.filter((a) => !a.read).length;
  return (
    <div className="flex items-start justify-center pt-4 pb-96">
      <NotificationMenu
        items={items}
        sources={[{
          key: 'alarms',
          label: 'Alarms',
          unread: open,
          items: alarmItems,
          action: open > 0 ? { label: `Acknowledge all (${open})`, onClick: () => setAcked(['a1', 'a2']) } : undefined,
          viewAll: { label: 'View all alarms', href: '#alarms' },
          emptyLabel: 'No open alarms',
        }]}
        onMarkAllRead={() => setItems((prev) => prev.map((n) => ({ ...n, read: true })))}
        now={Date.UTC(2026, 9, 26, 12)}
        locale="en-GB"
      />
    </div>
  );
}

function NotificationMenuEmptyDemo() {
  return (
    <div className="flex items-start justify-center pt-4 pb-52">
      <NotificationMenu items={[]} onViewAll={() => {}} />
    </div>
  );
}


/* ─── SubscriptionPlanCard demos ─── */

const DEMO_PLANS: SubscriptionPlan[] = [
  {
    planId: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    currency: 'USD',
    interval: 'MONTHLY',
    features: ['1 project', '2 team members', 'Community support'],
  },
  {
    planId: 'pro',
    name: 'Pro',
    description: 'Best for growing teams',
    price: 1900,
    currency: 'USD',
    interval: 'MONTHLY',
    features: ['Unlimited projects', '10 team members', 'Priority support', 'Advanced analytics'],
    isPopular: true,
  },
  {
    planId: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 9900,
    currency: 'USD',
    interval: 'MONTHLY',
    features: ['Unlimited everything', 'Dedicated support', 'SLA guarantee', 'Custom integrations', 'SSO'],
  },
];

function SubscriptionPlanGridDemo() {
  const [current] = useState('pro');
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6">
      {DEMO_PLANS.map((plan) => (
        <SubscriptionPlanCard
          key={plan.planId}
          plan={plan}
          isCurrent={plan.planId === current}
          onSelect={() => {}}
        />
      ))}
    </div>
  );
}

function SubscriptionPlanStatesDemo() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6">
      <SubscriptionPlanCard plan={DEMO_PLANS[1]} isCurrent onSelect={() => {}} />
      <SubscriptionPlanCard plan={{ ...DEMO_PLANS[2], isPopular: false }} onSelect={() => {}} />
    </div>
  );
}

/* ─── CountrySelector demos ─── */

function CountrySelectorDemo() {
  const [country, setCountry] = useState('TR');
  return (
    <div className="w-full max-w-xs mx-auto p-4">
      <CountrySelector value={country} onChange={setCountry} />
      <p className="text-xs text-text-secondary mt-2">Selected: <span className="font-mono">{country}</span></p>
    </div>
  );
}

function CountrySelectorStatesDemo() {
  const [country, setCountry] = useState('');
  return (
    <div className="w-full max-w-xs mx-auto p-4 space-y-4">
      <CountrySelector value={country} onChange={setCountry} hint="Used for shipping address." />
      <CountrySelector value={country} onChange={setCountry} error="Please select a country." required />
    </div>
  );
}

function CountrySelectorNoLabelDemo() {
  const [country, setCountry] = useState('US');
  return (
    <div className="w-full max-w-xs mx-auto p-4">
      <CountrySelector value={country} onChange={setCountry} label="" />
    </div>
  );
}
