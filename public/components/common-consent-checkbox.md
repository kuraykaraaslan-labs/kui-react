# ConsentCheckbox

- **id:** `common-consent-checkbox`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/common/consent/ConsentCheckbox.tsx`
- **status:** stable
- **since:** 2026-11

An explicit consent, unticked by default (automatic renewal, terms, distance-selling pre-information): the box, the statement as its label and a "Read the text" link that opens the full versioned text in a Drawer without ticking the box. Required and invalid states with aria-required, aria-invalid and the error tied by aria-describedby; every string from `messages`.

## Variants

### Required, with the text

```tsx
<ConsentCheckbox checked={consent} onChange={setConsent} required label="I agree …" textTitle="Automatic renewal terms" version="v3" text={body} />
```

### Invalid after submit

```tsx
<ConsentCheckbox checked={false} onChange={setConsent} required invalid label="I have read the pre-information." text={body} />
```

## Full source

```tsx
<ConsentCheckbox
  checked={consent}
  onChange={setConsent}
  required
  invalid={submitted && !consent}
  label="I agree that my subscription renews automatically …"
  textTitle="Automatic renewal terms"
  version={text.version}
  text={text.body}
/>
```
