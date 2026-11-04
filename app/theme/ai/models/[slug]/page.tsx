import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge } from '@/modules/ui/Badge';
import { DescriptionList } from '@/modules/ui/DescriptionList';
import { ModelCard } from '@/modules/domains/ai/model/ModelCard';
import { ModelProviderBadge } from '@/modules/domains/ai/model/ModelProviderBadge';
import { ModelTypeBadge } from '@/modules/domains/ai/model/ModelTypeBadge';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faMicrochip,
  faDollarSign,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import { MODELS } from '../../ai.data';
import { buildPageTitle, THEME_TITLES } from '@/libs/config/showcase.config';

export function generateStaticParams() {
  return MODELS.map((m) => ({ slug: m.modelId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const model = MODELS.find((m) => m.modelId === slug);
  return { title: buildPageTitle(model?.name ?? slug, THEME_TITLES.ai) };
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const model = MODELS.find((m) => m.modelId === slug);

  if (!model) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-text-primary">Model not found</h1>
        <Link href="/theme/ai/models" className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5" aria-hidden="true" />
          Back to models
        </Link>
      </div>
    );
  }

  const relatedModels = MODELS.filter(
    (m) => m.modelId !== model.modelId && (m.provider === model.provider || m.type === model.type)
  ).slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-text-secondary">
          <li>
            <Link href="/theme/ai/models" className="hover:text-text-primary transition-colors inline-flex items-center gap-1.5">
              <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5" aria-hidden="true" />
              Models
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-text-primary font-medium">{model.name}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main detail */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="rounded-xl border border-border bg-surface-raised p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">{model.name}</h1>
                <p className="text-sm font-mono text-text-secondary mt-1">{model.modelId}</p>
              </div>
              {model.active ? (
                <Badge variant="success" size="md" dot>Active</Badge>
              ) : (
                <Badge variant="neutral" size="md" dot>Inactive</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <ModelProviderBadge provider={model.provider} />
              <ModelTypeBadge type={model.type} />
            </div>
          </div>

          {/* Pricing table */}
          <div className="rounded-xl border border-border bg-surface-raised p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">Pricing</h2>
            {/* two label/value lines of one model: the kit's DescriptionList (a record's details), not a table */}
            <DescriptionList
              items={[
                { label: 'Input (prompt), per 1k tokens', mono: true, value: model.pricingPromptPer1k != null ? `$${model.pricingPromptPer1k.toFixed(5)}` : null },
                { label: 'Output (completion), per 1k tokens', mono: true, value: model.pricingCompletionPer1k != null ? `$${model.pricingCompletionPer1k.toFixed(5)}` : null },
              ]}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Specs */}
          <div className="rounded-xl border border-border bg-surface-raised p-5 space-y-4">
            <h2 className="text-base font-semibold text-text-primary">Specifications</h2>
            <ul className="space-y-3">
              {model.contextWindow != null && (
                <li className="flex items-center gap-3">
                  <FontAwesomeIcon icon={faMicrochip} className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-text-secondary">Context window</p>
                    <p className="text-sm font-medium text-text-primary">
                      {model.contextWindow.toLocaleString()} tokens
                    </p>
                  </div>
                </li>
              )}
              {model.maxOutputTokens != null && (
                <li className="flex items-center gap-3">
                  <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-text-secondary">Max output tokens</p>
                    <p className="text-sm font-medium text-text-primary">
                      {model.maxOutputTokens.toLocaleString()} tokens
                    </p>
                  </div>
                </li>
              )}
              {model.pricingPromptPer1k != null && (
                <li className="flex items-center gap-3">
                  <FontAwesomeIcon icon={faDollarSign} className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-text-secondary">Prompt pricing</p>
                    <p className="text-sm font-medium text-text-primary">
                      ${model.pricingPromptPer1k.toFixed(5)} / 1k tokens
                    </p>
                  </div>
                </li>
              )}
            </ul>
          </div>

          {/* Try in playground */}
          <Link
            href="/theme/ai/playground"
            className="block rounded-xl border border-primary/30 bg-primary-subtle px-5 py-4 text-center hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <p className="text-sm font-semibold text-primary">Try in Playground</p>
            <p className="text-xs text-text-secondary mt-1">Interactive chat with this model</p>
          </Link>
        </div>
      </div>

      {/* Related models */}
      {relatedModels.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Related Models</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedModels.map((m) => (
              <ModelCard
                key={m.modelId}
                model={m}
                href={`/theme/ai/models/${m.modelId}`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
