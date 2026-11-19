'use client';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faUserGroup } from '@fortawesome/free-solid-svg-icons';
import { ComboBox, type ComboBoxOption } from '@/modules/ui/ComboBox';
import { useIotAdapter, useIotText } from '../api/IotAdapterProvider';
import type { IotMessages, IotMessagesInput } from '../messages';
import type { IotAccessSubject } from '../types/access';
import { subjectTypeLabel } from './AccessGrantTable';

/**
 * AccessSubjectPicker — picks one member or group (restricted IoT access) on the generic ComboBox: typing asks the host's merged
 * search (`access.searchSubjects`, after the pause), each hit with its icon and its hint (an e-mail, "Group"); a failed search says
 * so under the field. `onChange` gets the whole subject (null when cleared). Draws nothing without `adapter.access`.
 */
export type AccessSubjectPickerProps = {
  value: IotAccessSubject | null;
  onChange: (subject: IotAccessSubject | null) => void;
  /** The field's label; default "Member or group". */
  label?: string;
  hint?: string;
  disabled?: boolean;
  messages?: IotMessagesInput;
  className?: string;
};

const keyOf = (s: Pick<IotAccessSubject, 'type' | 'id'>) => `${s.type}:${s.id}`;

function optionOf(s: IotAccessSubject, m: IotMessages): ComboBoxOption {
  return {
    value: keyOf(s),
    label: s.label,
    description: s.hint || subjectTypeLabel(s.type, m),
    icon: <FontAwesomeIcon icon={s.type === 'GROUP' ? faUserGroup : faUser} className="h-3 w-3 text-text-secondary" aria-hidden="true" />,
  };
}

export function AccessSubjectPicker({ value, onChange, label, hint, disabled, messages, className }: AccessSubjectPickerProps) {
  const api = useIotAdapter().access;
  const { m } = useIotText(messages);
  const id = useId();
  const [failed, setFailed] = useState(false);
  // every subject a search answered, so a picked option's key leads back to the whole subject
  const seen = useRef(new Map<string, IotAccessSubject>());
  const search = api?.searchSubjects;
  const onSearch = useCallback(async (text: string, signal?: AbortSignal) => {
    if (!search) return [];
    try {
      const found = await search(text, signal);
      for (const s of found) seen.current.set(keyOf(s), s);
      setFailed(false);
      return found.map((s) => optionOf(s, m));
    } catch (e) {
      if (signal?.aborted) throw e;
      setFailed(true);
      return [];
    }
  }, [search, m]);
  // the picked subject stays an option, so the closed field shows its name
  const options = useMemo(() => (value ? [optionOf(value, m)] : []), [value, m]);

  if (!api) return null;
  return (
    <ComboBox
      id={`iot-access-subject-${id}`}
      className={className}
      label={label ?? m.access.pickSubject}
      hint={hint}
      placeholder={m.access.searchSubjects}
      options={options}
      value={value ? keyOf(value) : ''}
      onChange={(key) => onChange(key ? (seen.current.get(key) ?? (value && keyOf(value) === key ? value : null)) : null)}
      onSearch={onSearch}
      disabled={disabled}
      error={failed ? m.access.subjectsFailed : undefined}
      noResultsText={m.access.noSubjects}
      messages={{ clear: m.access.clearChoice, loading: m.common.loading }}
    />
  );
}
