'use client';
import { useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faPlus, faCircleCheck, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { Badge } from '@/modules/ui/Badge';
import { RadioGroup, type RadioOption } from '@/modules/ui/RadioGroup';
import { Textarea } from '@/modules/ui/Textarea';
import { ProductImageGallery } from '@/modules/domains/commerce/product/ProductImageGallery';
import { LogoPlacementEditor } from './LogoPlacementEditor';
import { formatTRY, type PromoProduct, type QuoteItem, type LogoPlacement } from './promozone.data';

type ProductDetailViewProps = {
  product: PromoProduct;
  categoryName?: string;
  /** Düzenleme modunda mevcut kalem — alanlar bununla önceden doldurulur. */
  editingItem?: QuoteItem | null;
  onBack: () => void;
  onSubmit: (item: QuoteItem) => void;
};

const QTY_STEP = 50;

/**
 * Ürün detay + konfigüratör — tam sayfa görünüm (Modal değil).
 * Her ürün/düzenleme için `key` ile yeniden mount edilir; bu yüzden
 * başlangıç değerleri doğrudan props'tan lazy useState ile alınır (effect yok).
 */
export function ProductDetailView({ product, categoryName, editingItem, onBack, onSubmit }: ProductDetailViewProps) {
  const [colorName, setColorName] = useState<string | undefined>(
    () => editingItem?.color?.name ?? product.colors[0]?.name,
  );
  const [printed, setPrinted] = useState<boolean>(() => (editingItem ? editingItem.printed : true));
  const [technique, setTechnique] = useState<string | undefined>(
    () => editingItem?.printTechnique ?? product.printOptions[0]?.technique,
  );
  const [position, setPosition] = useState<string | undefined>(
    () => editingItem?.printPosition ?? product.printOptions[0]?.positions[0],
  );
  const [quantity, setQuantity] = useState<number>(() => editingItem?.quantity ?? product.minimumOrderQuantity);
  const [logo, setLogo] = useState<LogoPlacement | null>(() => editingItem?.logo ?? null);
  const [note, setNote] = useState<string>(() => editingItem?.note ?? '');

  const activePrintOption = product.printOptions.find((o) => o.technique === technique);
  const positions = activePrintOption?.positions ?? [];

  const colorOptions: RadioOption[] = product.colors.map((c) => ({
    value: c.name,
    label: c.name,
    icon: (
      <span
        className="inline-block h-4 w-4 rounded-full border border-border-strong"
        style={{ background: c.hex }}
      />
    ),
  }));

  const printedOptions: RadioOption[] = [
    { value: 'yes', label: 'Printed', hint: 'With logo' },
    { value: 'no', label: 'No print', hint: 'Plain product' },
  ];

  const techniqueOptions: RadioOption[] = product.printOptions.map((o) => ({ value: o.technique, label: o.technique }));
  const positionOptions: RadioOption[] = positions.map((p) => ({ value: p, label: p }));

  function handleTechniqueChange(next: string) {
    setTechnique(next);
    const opt = product.printOptions.find((o) => o.technique === next);
    setPosition(opt?.positions[0]);
  }

  function decrement() {
    setQuantity((q) => Math.max(product.minimumOrderQuantity, q - QTY_STEP));
  }
  function increment() {
    setQuantity((q) => q + QTY_STEP);
  }
  function handleQtyInput(value: string) {
    const n = parseInt(value.replace(/\D/g, ''), 10);
    setQuantity(Number.isNaN(n) ? product.minimumOrderQuantity : n);
  }

  function handleSubmit() {
    const safeQty = Math.max(product.minimumOrderQuantity, quantity || 0);
    const color = product.colors.find((c) => c.name === colorName);
    const item: QuoteItem = {
      id: editingItem?.id ?? crypto.randomUUID(),
      productId: product.id,
      snapshot: {
        sku: product.sku,
        name: product.name,
        image: product.image,
        minimumPrice: product.minimumPrice,
        maximumPrice: product.maximumPrice,
      },
      quantity: safeQty,
      color,
      printed,
      printTechnique: printed ? technique : undefined,
      printPosition: printed ? position : undefined,
      logo: printed ? logo ?? undefined : undefined,
      note: note.trim() || undefined,
    };
    onSubmit(item);
  }

  const belowMoq = quantity < product.minimumOrderQuantity;
  const estMin = formatTRY(quantity * product.minimumPrice);
  const estMax = formatTRY(quantity * product.maximumPrice);

  return (
    <div className="pb-28">
      {/* Üst bar: geri + breadcrumb */}
      <div className="border-b border-border bg-surface-raised">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            iconLeft={<FontAwesomeIcon icon={faChevronLeft} className="h-3 w-3" aria-hidden="true" />}
          >
            Back to catalog
          </Button>
          <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-xs text-text-secondary sm:flex">
            <span>Catalog</span>
            {categoryName && (
              <>
                <span aria-hidden="true">/</span>
                <span>{categoryName}</span>
              </>
            )}
            <span aria-hidden="true">/</span>
            <span className="text-text-primary">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Sol: galeri + açıklama + özellikler */}
          <div className="space-y-5">
            <ProductImageGallery
              images={product.gallery.map((src) => ({ src, alt: product.name }))}
              aspect="square"
            />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Product description</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{product.description}</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Technical specs</h2>
              <dl className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface-raised p-4">
                {product.specs.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-text-secondary">{s.label}</dt>
                    <dd className="font-medium text-text-primary">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Sağ: başlık + konfigürasyon */}
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success" size="sm" dot>In stock</Badge>
                <Badge variant="neutral" size="sm">Min. {product.minimumOrderQuantity} units</Badge>
                {product.isFeatured && <Badge variant="primary" size="sm">Featured</Badge>}
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-text-primary">{product.name}</h1>
              <p className="mt-1 font-mono text-sm text-text-disabled">{product.sku}</p>
              <p className="mt-3 text-lg font-semibold text-text-primary">
                {formatTRY(product.minimumPrice)} – {formatTRY(product.maximumPrice)}
                <span className="ml-1 text-sm font-normal text-text-secondary">/ unit (est.)</span>
              </p>
            </div>

            <hr className="border-border" />

            {/* Renk */}
            {colorOptions.length > 0 && (
              <RadioGroup
                name={`color-${product.id}`}
                legend="Color"
                variant="card"
                columns={3}
                options={colorOptions}
                value={colorName}
                onChange={setColorName}
              />
            )}

            {/* Baskılı / baskısız */}
            <RadioGroup
              name={`printed-${product.id}`}
              legend="Print"
              variant="card"
              columns={2}
              options={printedOptions}
              value={printed ? 'yes' : 'no'}
              onChange={(v) => setPrinted(v === 'yes')}
            />

            {/* Baskı tekniği + konumu */}
            {printed && (
              <>
                <RadioGroup
                  name={`technique-${product.id}`}
                  legend="Print technique"
                  variant="card"
                  columns={2}
                  options={techniqueOptions}
                  value={technique}
                  onChange={handleTechniqueChange}
                />

                {positionOptions.length > 0 && (
                  <RadioGroup
                    name={`position-${product.id}`}
                    legend="Print position"
                    variant="card"
                    columns={3}
                    options={positionOptions}
                    value={position}
                    onChange={setPosition}
                  />
                )}

                {/* Logo yerleştirme (hizalama + zoom + döndürme) */}
                <LogoPlacementEditor
                  productImage={product.image}
                  printPositionLabel={position}
                  value={logo}
                  onChange={setLogo}
                />
              </>
            )}

            {/* Adet */}
            <div className="space-y-1.5">
              <label htmlFor={`qty-${product.id}`} className="block text-sm font-medium text-text-primary">
                Order quantity
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={decrement}
                  aria-label="Decrease quantity"
                  disabled={quantity <= product.minimumOrderQuantity}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-primary',
                    'transition-colors hover:bg-surface-overlay',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <FontAwesomeIcon icon={faMinus} className="h-3 w-3" aria-hidden="true" />
                </button>
                <input
                  id={`qty-${product.id}`}
                  type="text"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => handleQtyInput(e.target.value)}
                  className={cn(
                    'w-24 rounded-md border border-border bg-surface-base px-3 py-2 text-center text-sm font-medium text-text-primary',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                  )}
                />
                <button
                  type="button"
                  onClick={increment}
                  aria-label="Increase quantity"
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-primary',
                    'transition-colors hover:bg-surface-overlay',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                  )}
                >
                  <FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
              {belowMoq && (
                <p className="text-xs text-error" role="alert">
                  Minimum order quantity is {product.minimumOrderQuantity}.
                </p>
              )}
            </div>

            {/* Not */}
            <Textarea
              id={`note-${product.id}`}
              label="Note"
              rows={3}
              placeholder="Print color, Pantone code, special requests…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-base/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs text-text-secondary">Estimated total ({quantity} units)</p>
            <p className="text-sm font-semibold text-text-primary">{estMin} – {estMax}</p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={belowMoq}
            iconLeft={<FontAwesomeIcon icon={faCircleCheck} className="h-4 w-4" aria-hidden="true" />}
          >
            {editingItem ? 'Update item' : 'Add to quote list'}
          </Button>
        </div>
      </div>
    </div>
  );
}
