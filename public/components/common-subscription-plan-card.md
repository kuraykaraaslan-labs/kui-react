# SubscriptionPlanCard

- **id:** `common-subscription-plan-card`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/common/subscription/SubscriptionPlanCard.tsx`
- **status:** stable
- **since:** 2025-05

Subscription plan card: name, locale-aware price ("Free" at zero, a struck list price beside a discount), an optional interval switch, a price note, the renewal line ("Renews on <date> for <amount>" / "Ends on <date>"), the trial line ("Trial ends on <date>; then <amount>"), the "Assigned by the operator" badge, features and one action (none without onSelect or on the current plan; "Selected" with aria-pressed; actionNote in its place). "Cancel renewal" confirms in a ConfirmDialog with the no-refund sentence; "Resume renewal" on a plan that ends.

## Variants

### Plan grid

```tsx
<div className="grid grid-cols-3 gap-4">
  <SubscriptionPlanCard plan={freePlan} onSelect={handleSelect} />
  <SubscriptionPlanCard plan={proPlan} isCurrent onSelect={handleSelect} />
  <SubscriptionPlanCard plan={enterprisePlan} onSelect={handleSelect} />
</div>
```

### Single card states

```tsx
<SubscriptionPlanCard plan={plan} isCurrent />
<SubscriptionPlanCard plan={{ ...plan, isPopular: true }} onSelect={handleSelect} />
```

### Renewal, trial and operator assignment

```tsx
<SubscriptionPlanCard plan={pro} isCurrent renewal={{ date: periodEnd, amount: pro.price, ends: cancelAtPeriodEnd }}
  onCancelRenewal={cancelRenewal} onResumeRenewal={resumeRenewal} />
<SubscriptionPlanCard plan={team} isCurrent trial={{ endsOn: trialEnd, thenAmount: team.price }} />
<SubscriptionPlanCard plan={pro} isCurrent assignedByOperator renewal={{ date: termEnd, ends: true }} />
```

### Interval switch, discount and a free plan

```tsx
<SubscriptionPlanCard plan={plan} intervalOptions={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'YEARLY', label: 'Yearly', badge: '-17%' }]}
  onIntervalChange={setTerm} discount={{ amount: 24000, note: 'LAUNCH: first year' }} actionLabel="Upgrade to Pro" onSelect={choose} />
<SubscriptionPlanCard plan={free} onSelect={choose} actionNote="Assigned by your workspace plan" />
```

## Full source

```tsx
'use client';
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
/>
```
