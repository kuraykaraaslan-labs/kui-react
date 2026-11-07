'use client';
import { Form } from '@/modules/app/Form';
import { SectionCard } from '@/modules/app/SectionCard';
import { InlineAlert } from '@/modules/app/InlineAlert';
import { StepShell } from '@/modules/app/StepShell';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { MultiSelect } from '@/modules/ui/MultiSelect';
import { Toggle } from '@/modules/ui/Toggle';
import { Textarea } from '@/modules/ui/Textarea';
import { FilterBar, type FilterField, type FilterValues } from '@/modules/app/FilterBar';
import { FileUploadSection } from '@/modules/app/FileUploadSection';
import { OnboardingWizard, type OnboardingStep } from '@/modules/app/OnboardingWizard';
import { Tour, type TourStep } from '@/modules/app/Tour';
import { Button } from '@/modules/ui/Button';
import { useState } from 'react';
import type { ShowcaseComponent } from '../showcase.types';

const FILTER_FIELDS: FilterField[] = [
  {
    type: 'select',
    id: 'status',
    label: 'Status',
    options: [
      { value: 'active',    label: 'Active'    },
      { value: 'invited',   label: 'Invited'   },
      { value: 'suspended', label: 'Suspended' },
    ],
    placeholder: 'All statuses',
  },
  {
    type: 'multiselect',
    id: 'role',
    label: 'Role',
    options: [
      { value: 'admin',  label: 'Admin'  },
      { value: 'editor', label: 'Editor' },
      { value: 'viewer', label: 'Viewer' },
    ],
    placeholder: 'Any role',
  },
  { type: 'daterange', id: 'period', label: 'Created at' },
  { type: 'tags',      id: 'tags',   label: 'Tags', placeholder: 'Add filter tag…' },
];

const INITIAL_FILTER_VALUES: FilterValues = {
  status: '',
  role: [],
  period: { start: null, end: null },
  tags: [],
};

function FormDemo({ columns }: { columns: 1 | 2 }) {
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [visibility,  setVisibility]  = useState('private');
  const [stack,       setStack]       = useState<string[]>(['next', 'ts']);
  const [description, setDescription] = useState('');
  const [notify,      setNotify]      = useState(true);
  const [nameError,   setNameError]   = useState('');
  const [emailError,  setEmailError]  = useState('');
  const [formError,   setFormError]   = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nameErr  = !name.trim()          ? 'Project name is required.' : '';
    const emailErr = !email.includes('@')  ? 'Valid email is required.'  : '';
    setNameError(nameErr);
    setEmailError(emailErr);
    if (nameErr || emailErr) { setFormError('Please fix the errors above before saving.'); return; }
    setFormError('');
  }

  function handleCancel() {
    setName(''); setEmail(''); setVisibility('private');
    setStack(['next', 'ts']); setDescription(''); setNotify(true);
    setNameError(''); setEmailError(''); setFormError('');
  }

  return (
    <Form
      title="Create project"
      description="Fill in the details to create a new project."
      error={formError}
      columns={columns}
      onSubmit={handleSubmit}
      actions={
        <>
          <Button variant="outline" type="button" onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" type="submit">Save project</Button>
        </>
      }
    >
      <Input id="name"  label="Project name" placeholder="Acme Redesign" required value={name}  onChange={(e) => setName(e.target.value)}  error={nameError}  />
      <Input id="email" label="Owner email"  type="email" placeholder="owner@acme.com" required value={email} onChange={(e) => setEmail(e.target.value)} error={emailError} />
      <Select id="visibility" label="Visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}
        options={[{ value: 'private', label: 'Private' }, { value: 'internal', label: 'Internal' }, { value: 'public', label: 'Public' }]} />
      <MultiSelect id="stack" label="Tech stack" value={stack} onChange={setStack}
        options={[{ value: 'next', label: 'Next.js' }, { value: 'react', label: 'React' }, { value: 'ts', label: 'TypeScript' }, { value: 'tailwind', label: 'Tailwind' }]} />
      <div className={columns === 2 ? 'sm:col-span-2' : ''}>
        <Textarea id="description" label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className={columns === 2 ? 'sm:col-span-2' : ''}>
        <Toggle id="notify" label="Send team notifications" description="Notify members after creation." checked={notify} onChange={setNotify} />
      </div>
    </Form>
  );
}

function FilterBarDemo({ compact = false }: { compact?: boolean }) {
  const [values, setValues] = useState<FilterValues>(INITIAL_FILTER_VALUES);
  const fields = compact ? FILTER_FIELDS.slice(0, 2) : FILTER_FIELDS;

  function handleReset() {
    setValues({ status: '', role: [], period: { start: null, end: null }, tags: [] });
  }

  return (
    <FilterBar
      fields={fields}
      values={values}
      onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
      onApply={() => {}}
      onReset={handleReset}
    />
  );
}

export function buildAppFormData(): ShowcaseComponent[] {
  return [
    {
      id: 'section-card',
      title: 'SectionCard',
      category: 'App',
      abbr: 'SC',
      description: 'Titled content card with rounded-xl + border + bg-surface-raised + p-6. Header is separated by an underline; children slot accepts arbitrary content.',
      filePath: 'modules/app/SectionCard.tsx',
      sourceCode: `import { SectionCard } from '@/modules/app/SectionCard';

<SectionCard title="Preferences">
  <UserPreferencesForm ... />
</SectionCard>

<SectionCard title="Change Password">
  <ChangePasswordForm ... />
</SectionCard>`,
      variants: [
        {
          title: 'Tek bölüm',
          layout: 'stack' as const,
          preview: (
            <SectionCard title="Preferences">
              <p className="text-sm text-text-secondary">Form fields go here.</p>
            </SectionCard>
          ),
          code: `<SectionCard title="Preferences">
  <Input id="name" label="Display name" value={name} onChange={...} />
  <Toggle id="notify" label="Email notifications" checked={notify} onChange={setNotify} />
</SectionCard>`,
        },
        {
          title: 'Birden fazla bölüm',
          layout: 'stack' as const,
          preview: (
            <div className="space-y-4 max-w-lg">
              <SectionCard title="Profile">
                <p className="text-sm text-text-secondary">Personal information fields.</p>
              </SectionCard>
              <SectionCard title="Security">
                <p className="text-sm text-text-secondary">Password change form.</p>
              </SectionCard>
            </div>
          ),
          code: `<SectionCard title="Profile">
  <UserProfileForm ... />
</SectionCard>
<SectionCard title="Security">
  <ChangePasswordForm ... />
</SectionCard>`,
        },
      ],
    },

    {
      id: 'inline-alert',
      title: 'InlineAlert',
      category: 'App',
      abbr: 'IA',
      description: 'Compact inline alert strip used next to form fields or inside cards. success / error / warning / info variants; icon + single-line message.',
      filePath: 'modules/app/InlineAlert.tsx',
      sourceCode: `import { InlineAlert } from '@/modules/app/InlineAlert';

// Default: success
<InlineAlert message="Changes saved." />

// Error
<InlineAlert variant="error" message="Something went wrong." />

// Conditional display (e.g. after save)
{saved && <InlineAlert message="Profile saved successfully." />}`,
      variants: [
        {
          title: 'Tüm variantlar',
          layout: 'stack' as const,
          preview: (
            <div className="space-y-2 max-w-sm">
              <InlineAlert variant="success" message="Changes saved successfully." />
              <InlineAlert variant="error"   message="Something went wrong. Please try again." />
              <InlineAlert variant="warning" message="Please review your changes before saving." />
              <InlineAlert variant="info"    message="This action cannot be undone." />
            </div>
          ),
          code: `<InlineAlert variant="success" message="Changes saved successfully." />
<InlineAlert variant="error"   message="Something went wrong." />
<InlineAlert variant="warning" message="Please review before saving." />
<InlineAlert variant="info"    message="This action cannot be undone." />`,
        },
      ],
    },

    {
      id: 'step-shell',
      title: 'StepShell',
      category: 'App',
      abbr: 'Ss',
      description: 'Wrapper card for a single step in a multi-step flow. Border and number circle change based on active / done / inactive state; the done + onEdit combination shows an Edit button alongside the summary.',
      filePath: 'modules/app/StepShell.tsx',
      sourceCode: `import { StepShell } from '@/modules/app/StepShell';

// Done step — shows summary, allows editing
<StepShell
  number={1}
  title="Delivery address"
  active={false}
  done
  summary={<AddressCard address={selected} />}
  onEdit={() => setStep('address')}
/>

// Active step — shows children
<StepShell number={2} title="Payment method" active done={false}>
  <PaymentMethodSelector ... />
  <Button onClick={() => setStep('details')}>Continue</Button>
</StepShell>

// Pending step — title dimmed, no content
<StepShell number={3} title="Review &amp; pay" active={false} done={false} />`,
      variants: [
        {
          title: 'Active / Done / Pending',
          layout: 'stack' as const,
          preview: (
            <div className="space-y-3 max-w-lg">
              <StepShell
                number={1}
                title="Delivery address"
                active={false}
                done
                summary={<p className="text-sm text-text-secondary font-mono">123 Main St, İstanbul</p>}
                onEdit={() => {}}
              />
              <StepShell number={2} title="Payment method" active done={false}>
                <p className="text-sm text-text-secondary py-2">Select a payment method to continue.</p>
                <Button size="sm">Continue</Button>
              </StepShell>
              <StepShell number={3} title="Review &amp; pay" active={false} done={false} />
            </div>
          ),
          code: `<StepShell number={1} title="Delivery address" active={false} done
  summary={<AddressCard address={address} />}
  onEdit={() => setStep('address')}
/>
<StepShell number={2} title="Payment method" active done={false}>
  <PaymentMethodSelector value={method} onChange={setMethod} />
  <Button onClick={() => setStep('details')}>Continue</Button>
</StepShell>
<StepShell number={3} title="Review &amp; pay" active={false} done={false} />`,
        },
      ],
    },

    {
      id: 'form',
      title: 'Form',
      category: 'App',
      abbr: 'Fm',
      description: 'Form layout wrapper with title, description, error and actions slots. `columns` prop renders fields in a 1 or 2 column grid.',
      filePath: 'modules/app/Form.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { AlertBanner } from '@/modules/ui/AlertBanner';

export function Form({ title, description, error, columns = 1, actions, children, onSubmit, className }) {
  return (
    <form onSubmit={onSubmit} noValidate className={cn('space-y-6', className)}>
      {(title || description) && (
        <div>
          {title && <h2 className="text-lg font-semibold text-text-primary">{title}</h2>}
          {description && <p className="text-sm text-text-secondary mt-0.5">{description}</p>}
        </div>
      )}
      {error && <AlertBanner variant="error" message={error} />}
      <div className={cn('grid gap-4', columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
        {children}
      </div>
      {actions && (
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          {actions}
        </div>
      )}
    </form>
  );
}`,
      variants: [
        {
          title: 'Single column',
          layout: 'stack' as const,
          preview: <FormDemo columns={1} />,
          code: `<Form
  title="Create project"
  description="Fill in the details to create a new project."
  onSubmit={handleSubmit}
  actions={
    <>
      <Button variant="outline" type="button" onClick={handleCancel}>Cancel</Button>
      <Button variant="primary" type="submit">Save project</Button>
    </>
  }
>
  <Input id="name" label="Project name" required value={name} onChange={...} error={nameError} />
  <Input id="email" label="Owner email" type="email" required value={email} onChange={...} />
  <Select id="visibility" label="Visibility" value={visibility} onChange={...} options={options} />
  <Toggle id="notify" label="Send notifications" checked={notify} onChange={setNotify} />
</Form>`,
        },
        {
          title: 'Two column',
          layout: 'stack' as const,
          preview: <FormDemo columns={2} />,
          code: `<Form title="Create project" columns={2} onSubmit={handleSubmit} actions={<Button type="submit">Save</Button>}>
  <Input id="name" label="Project name" required value={name} onChange={...} />
  <Input id="email" label="Owner email" type="email" value={email} onChange={...} />
  <Select id="visibility" label="Visibility" value={visibility} onChange={...} options={options} />
  <MultiSelect id="stack" label="Tech stack" value={stack} onChange={setStack} options={options} />
  <div className="sm:col-span-2">
    <Textarea id="description" label="Description" value={description} onChange={...} />
  </div>
</Form>`,
        },
      ],
    },
    {
      id: 'filter-bar',
      title: 'FilterBar',
      category: 'App',
      abbr: 'FB',
      description: 'Select, multiselect, daterange and text-based filter panel. Supports URL-based filtering via GET form submit.',
      filePath: 'modules/app/FilterBar.tsx',
      sourceCode: `'use client';
import { FilterBar } from '@/modules/app/FilterBar';

export function Demo() {
  return (
    <FilterBar
      fields={fields}
      values={values}
      onChange={handleChange}
      onApply={handleApply}
      onReset={handleReset}
    />
  );
}`,
      variants: [
        {
          title: 'Full filter set',
          layout: 'stack' as const,
          preview: <FilterBarDemo />,
          code: `<FilterBar fields={fields} values={values} onChange={handleChange} onApply={handleApply} onReset={handleReset} />`,
        },
        {
          title: 'Compact filters',
          layout: 'stack' as const,
          preview: <FilterBarDemo compact />,
          code: `<FilterBar fields={fields.slice(0, 2)} values={values} onChange={handleChange} />`,
        },
      ],
    },
    {
      id: 'file-upload-section',
      title: 'FileUploadSection',
      category: 'App',
      abbr: 'FU',
      description:
        'High-level upload organism: drop zone + file list + remove. M1 implements drag/drop, paste-from-clipboard, accept-pattern + maxSize + maxFiles validation. M2 will add image thumbnails + crop dialog; M3 chunked + resumable uploads. Pixel-identical EJS sibling at modules/app/FileUploadSection/FileUploadSection.ejs.',
      filePath: 'modules/app/FileUploadSection/index.tsx',
      sourceCode: `'use client';
import { FileUploadSection } from '@/modules/app/FileUploadSection';

export function Demo() {
  return (
    <FileUploadSection
      title="Project attachments"
      hint="Drop files or paste a screenshot"
      multiple
      enablePaste
      accept="image/*,.pdf"
      maxFiles={6}
      maxSizeBytes={5 * 1024 * 1024}
    />
  );
}`,
      variants: [
        {
          title: 'Basic drop zone',
          layout: 'stack' as const,
          preview: (
            <FileUploadSection
              title="Project attachments"
              hint="PDF, images up to 5 MB each"
              multiple
              accept="image/*,.pdf"
              maxSizeBytes={5 * 1024 * 1024}
            />
          ),
          code: `<FileUploadSection title="Project attachments" hint="PDF, images up to 5 MB each"\n  multiple accept="image/*,.pdf" maxSizeBytes={5242880} />`,
        },
        {
          title: 'Paste from clipboard',
          layout: 'stack' as const,
          preview: (
            <FileUploadSection
              title="Bug report screenshots"
              hint="Drop, browse, or paste (Cmd/Ctrl + V while focused)"
              multiple
              enablePaste
              accept="image/*"
              maxFiles={5}
              maxSizeBytes={4 * 1024 * 1024}
            />
          ),
          code: `<FileUploadSection title="Bug report screenshots" multiple enablePaste\n  accept="image/*" maxFiles={5} maxSizeBytes={4 * 1024 * 1024}\n  hint="Drop, browse, or paste (Cmd/Ctrl + V while focused)" />`,
        },
      ],
    },
    {
      id: 'onboarding-wizard',
      title: 'OnboardingWizard',
      category: 'App',
      abbr: 'OW',
      since: '2026-05',
      description: 'Multi-step onboarding flow with dots/bar progress, optional skip, and page or modal presentation. Each step renders its own content slot.',
      filePath: 'modules/app/OnboardingWizard.tsx',
      sourceCode: `'use client';
import { OnboardingWizard, type OnboardingStep } from '@/modules/app/OnboardingWizard';

const steps: OnboardingStep[] = [
  { id: 'welcome', title: 'Welcome', description: 'Set up your workspace.', content: <WelcomeCopy /> },
  { id: 'profile', title: 'Profile',  content: <ProfileForm /> },
  { id: 'done',    title: 'All set!', content: <DoneCopy /> },
];

<OnboardingWizard
  steps={steps}
  indicator="dots"
  allowSkip
  onComplete={() => router.push('/dashboard')}
  onSkip={() => router.push('/dashboard')}
/>`,
      variants: [
        {
          title: 'Dots indicator (page mode)',
          layout: 'stack' as const,
          preview: <OnboardingDotsDemo />,
          code: `<OnboardingWizard
  steps={steps}
  indicator="dots"
  allowSkip
  onComplete={() => {}}
/>`,
        },
        {
          title: 'Progress bar indicator',
          layout: 'stack' as const,
          preview: <OnboardingBarDemo />,
          code: `<OnboardingWizard
  steps={steps}
  indicator="bar"
  allowSkip={false}
  onComplete={() => {}}
/>`,
        },
      ],
      composes: ['button', 'modal'],
      // 'step-flow' removed: modules/app/StepFlow.tsx exists but has no
      // showcase entry yet (found by modules/registry/registry.test.ts —
      // tracked as a real gap, not something to fabricate a relatedTo
      // reference to). Add it back once StepFlow is showcased.
      relatedTo: ['step-shell'],
      designTokens: ['--primary', '--surface-sunken', '--text-primary', '--text-secondary', '--border'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['role="progressbar"'],
        keyboardInteractions: [
          { keys: 'Enter / Click', action: 'Activate Next / Previous / Skip / Complete' },
        ],
        notes: 'Progress is announced via role="progressbar" with aria-valuenow updating on step change.',
      },
    },
    {
      id: 'tour',
      title: 'Tour',
      category: 'App',
      abbr: 'GT',
      since: '2026-11',
      description: 'Guided tour over the live page: each step dims the page, cuts out its target and explains it. Driver.js draws; the runner owns the steps, the text (plain text, never HTML) and the keyboard. Steps can wait for late content, run on other pages (beforeStep) and move on when the target is clicked. RTL mirrors placement and arrow keys.',
      filePath: 'modules/app/Tour/index.tsx',
      sourceCode: `'use client';
import { useState } from 'react';
import { Tour, type TourStep } from '@/modules/app/Tour';

const steps: TourStep[] = [
  { id: 'new', target: '[data-tour="demo.new"]', title: 'New rule', text: 'Start a rule here.', placement: 'bottom', advanceOn: 'click' },
  { id: 'filter', target: '[data-tour="demo.filter"]', text: 'Narrow the list.', placement: 'bottom' },
  { id: 'done', text: 'That is all. Open the tour again from the top bar.' },
];

const [open, setOpen] = useState(false);
<Button data-tour="demo.new">New rule</Button>
<Button onClick={() => setOpen(true)}>Take the tour</Button>
<Tour steps={steps} open={open} onClose={() => setOpen(false)} />`,
      variants: [
        {
          title: 'Three steps: click to advance, a plain step, a centred step',
          layout: 'stack' as const,
          preview: <TourDemo />,
          code: `<Tour steps={steps} open={open} onClose={(reason, index) => setOpen(false)} />`,
        },
        {
          title: 'Right-to-left: placement and arrow keys mirrored',
          layout: 'stack' as const,
          preview: <TourDemo dir="rtl" />,
          code: `<Tour steps={steps} open={open} dir="rtl" labels={{ next: 'التالي', previous: 'السابق', done: 'تم', close: 'إغلاق', progress: '{current} / {total}' }} onClose={() => setOpen(false)} />`,
        },
      ],
      composes: ['button'],
      relatedTo: ['onboarding-wizard'],
      designTokens: ['--surface-raised', '--text-primary', '--text-secondary', '--primary', '--border', '--border-focus'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['role="dialog"', 'aria-describedby'],
        keyboardInteractions: [
          { keys: 'Enter / Click', action: 'Next / Previous / Close' },
          { keys: '→ / ←', action: 'Next / previous step (mirrored in RTL)' },
          { keys: 'Escape', action: 'Stop the tour' },
        ],
        notes: 'Focus moves to the step\'s Next button on every step and returns to where it was when the tour ends.',
      },
    },
  ];
}

function TourDemo({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' }) {
  const [open, setOpen] = useState(false);
  const scope = dir === 'rtl' ? 'demo-rtl' : 'demo';
  const steps: TourStep[] = [
    { id: 'new', target: `[data-tour="${scope}.new"]`, title: 'New rule', text: 'Start a rule here. Clicking it also moves the tour on.', placement: 'right', advanceOn: 'click' },
    { id: 'filter', target: `[data-tour="${scope}.filter"]`, title: 'Filter', text: 'Narrow the list to what you need.', placement: 'bottom' },
    { id: 'done', title: 'All set', text: 'Open the tour again whenever you like.' },
  ];
  return (
    <div dir={dir} className="flex flex-wrap items-center gap-2">
      <Button data-tour={`${scope}.new`} variant="secondary">New rule</Button>
      <Button data-tour={`${scope}.filter`} variant="outline">Filter</Button>
      <Button onClick={() => setOpen(true)}>Take the tour</Button>
      <Tour steps={steps} open={open} dir={dir} onClose={() => setOpen(false)} />
    </div>
  );
}

function OnboardingDotsDemo() {
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      description: "Let's set up your workspace quickly.",
      content: (
        <p className="text-sm text-text-secondary leading-relaxed">
          We have a few questions for a personalized experience. Three steps in total.
        </p>
      ),
    },
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Your name and role will be visible to your team.',
      content: <p className="text-sm text-text-secondary">Form fields go here.</p>,
    },
    {
      id: 'done',
      title: 'All Set',
      content: (
        <p className="text-sm text-text-secondary">
          You&apos;re ready to begin. Click the button below.
        </p>
      ),
    },
  ];
  return (
    <OnboardingWizard
      steps={steps}
      indicator="dots"
      allowSkip
      onComplete={() => undefined}
      onSkip={() => undefined}
    />
  );
}

function OnboardingBarDemo() {
  const steps: OnboardingStep[] = [
    { id: '1', title: 'Workspace',    content: <p className="text-sm text-text-secondary">Workspace name.</p> },
    { id: '2', title: 'Invite Members', content: <p className="text-sm text-text-secondary">Invite your team members.</p> },
    { id: '3', title: 'Integration',  content: <p className="text-sm text-text-secondary">Connect a tool.</p> },
    { id: '4', title: 'Finish',       content: <p className="text-sm text-text-secondary">All steps completed.</p> },
  ];
  return (
    <OnboardingWizard
      steps={steps}
      indicator="bar"
      allowSkip={false}
      onComplete={() => undefined}
    />
  );
}
