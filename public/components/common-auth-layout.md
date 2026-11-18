# AuthLayout

- **id:** `common-auth-layout`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/common/auth/AuthLayout.tsx`
- **status:** stable

The frame of every authentication page, from the kit's own pieces: BrandLogo above a Card, the page title in PageHeader type with one line of real information (the workspace address), the form, an optional footer below.

## Variants

### Sign in

```tsx
<AuthLayout brand={<BrandLogo />} title="Sign in" description="acme.example.com" footer={...}><LoginForm onSubmit={handleLogin} /></AuthLayout>
```

### Title only

```tsx
<AuthLayout title="Verify your email" description="We sent a link to jane@acme.com.">…</AuthLayout>
```

## Full source

```tsx
import { AuthLayout } from '@/modules/domains/common/auth/AuthLayout';

<AuthLayout
  brand={<BrandLogo logoLight={logo} alt="Acme" />}
  title="Sign in"
  description="acme.example.com"
  footer={<>Don't have an account? <a href="/register">Sign up</a></>}
>
  <LoginForm onSubmit={handleLogin} />
</AuthLayout>
```
