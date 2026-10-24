// A filter as one readable line (ThingsBoard's entity-filter-view): "Devices of device profiles Pump, Tank whose name
// starts with 'A'", "Entities related TO the page's site (up to 3 levels)". Pure: no React. The wording lives in the
// messages (`text*`), so a host translates it there.

import { mergeAliasMessages, type EntityAliasesMessagesInput } from './messages';
import type { AliasRoot, BoardParamInfo, EntityAliasFilter, EntityTypeInfo, RelationProviderInfo } from './types';

export interface FilterTextOptions {
  entityTypes: readonly EntityTypeInfo[];
  params: readonly BoardParamInfo[];
  messages?: EntityAliasesMessagesInput;
  /** Gives relation types their labels (the stored value is shown otherwise). */
  relationProviders?: readonly RelationProviderInfo[];
  /** Entity names by id, for a single entity or a fixed root (the entity type is shown otherwise). */
  entityNames?: Readonly<Record<string, string>>;
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function entityFilterText(filter: EntityAliasFilter | null | undefined, options: FilterTextOptions): string {
  const m = mergeAliasMessages(options.messages);
  if (!filter || !filter.type) return m.noFilterText;

  const info = (key: string) => options.entityTypes.find((t) => t.key === key);
  const one = (key: string) => info(key)?.label ?? key;
  const many = (key: string) => info(key)?.labelPlural ?? key;
  const paramLabel = (key: string) => options.params.find((p) => p.key === key)?.label ?? key;
  const relationLabel = (provider: string, value: string) =>
    options.relationProviders?.find((p) => p.key === provider)?.relationTypes.find((r) => r.value === value)?.label ?? value;
  const rootText = (root: AliasRoot | undefined) => {
    if (!root) return '';
    if ('param' in root) return m.textRootParam(paramLabel(root.param));
    return m.textRootEntity(one(root.entity.type), options.entityNames?.[root.entity.id]);
  };

  switch (filter.type) {
    case 'singleEntity':
      return capitalize(m.textSingle(one(filter.entityType), options.entityNames?.[filter.id]));
    case 'entityList':
      return capitalize(m.textList(filter.ids?.length ?? 0, one(filter.entityType), many(filter.entityType)));
    case 'entityName':
      return capitalize(m.textName(many(filter.entityType), filter.namePrefix ?? ''));
    case 'entityType':
      return capitalize(m.textType(many(filter.entityType)));
    case 'stateEntity':
      return capitalize(m.textState(one(filter.entityType), paramLabel(filter.param)));
    case 'entitySubtype':
      return capitalize(
        m.textSubtype(many(filter.entityType), info(filter.entityType)?.subtypeLabel, filter.subtypes ?? [], filter.namePrefix?.trim() || undefined),
      );
    case 'relationsQuery': {
      const filters = filter.filters ?? [];
      const what = filters.length
        ? filters
            .map((f) =>
              m.textRelationFilter(
                f.entityTypes?.length ? f.entityTypes.map(many).join(', ') : null,
                f.relationType ? relationLabel(filter.provider, f.relationType) : null,
                !!f.negate,
              ),
            )
            .join(' or ')
        : m.textAnyEntities;
      return capitalize(
        m.textRelations(what, filter.direction, rootText(filter.root), undefined, m.textLevels(filter.maxLevel, !!filter.lastLevelOnly)),
      );
    }
    case 'entitySearchQuery': {
      const what = m.textSubtypesOf(many(filter.entityType), info(filter.entityType)?.subtypeLabel, filter.subtypes ?? []);
      return capitalize(
        m.textRelations(
          what,
          filter.direction,
          rootText(filter.root),
          filter.relationType ? relationLabel(filter.provider, filter.relationType) : undefined,
          m.textLevels(filter.maxLevel, !!filter.lastLevelOnly),
        ),
      );
    }
    default:
      return (filter as { type: string }).type;
  }
}
