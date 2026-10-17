import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParamForm, type ParamSuggest } from './ParamForm';
import { setField } from './field-utils';
import type { ParamChoices, ParamSpec } from '../catalog/types';
import { DEFAULT_MESSAGES, MessagesProvider } from '../RulesetEditor/messages';

/** a form that keeps its own values, the way the node panel does, and reports the latest ones */
function Harness({ schema, initial = {}, onValues, readOnly, choices, showRequired, suggest }: {
  schema: Record<string, ParamSpec>; initial?: Record<string, unknown>; onValues?: (v: Record<string, unknown>) => void;
  readOnly?: boolean; choices?: ParamChoices; showRequired?: boolean; suggest?: ParamSuggest;
}) {
  const [values, setValues] = useState(initial);
  return (
    <ParamForm
      schema={schema} values={values} readOnly={readOnly} choices={choices} showRequired={showRequired} suggest={suggest}
      onChange={(key, value) => {
        const next = setField(values, key, value);
        setValues(next);
        onValues?.(next);
      }}
    />
  );
}

describe('ParamForm', () => {
  it('renders nothing for an empty schema or when every field is hidden', () => {
    const { container } = render(<Harness schema={{}} />);
    expect(container).toBeEmptyDOMElement();
    const hidden: Record<string, ParamSpec> = { a: { type: 'string', when: { param: 'mode', value: 'x' } } };
    const second = render(<Harness schema={hidden} initial={{ mode: 'y' }} />);
    expect(second.container).toBeEmptyDOMElement();
  });

  it('labels fields from the key, an own label, and a unit', () => {
    render(<Harness schema={{ offset_min: { type: 'number' }, lat: { type: 'number', label: 'Latitude' }, ttl: { type: 'number', unit: 's' } }} />);
    expect(screen.getByLabelText('Offset min')).toBeInTheDocument();
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
    expect(screen.getByLabelText('Ttl (s)')).toBeInTheDocument();
  });

  it('shows a field only when its when condition holds, and updates as the other field changes', async () => {
    const user = userEvent.setup();
    const schema: Record<string, ParamSpec> = {
      mode: { type: 'enum', options: ['daily', 'cron'], default: 'daily' },
      time: { type: 'time', when: { param: 'mode', value: 'daily' } },
      cron: { type: 'cron', when: { param: 'mode', value: 'cron' } },
    };
    render(<Harness schema={schema} />);
    // the default of mode decides while nothing is stored
    expect(screen.getByLabelText('Time')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cron')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Mode'), 'cron');
    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cron')).toBeInTheDocument();
  });

  describe('fields', () => {
    it('text: sets the value, and removes the key when emptied', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ topic: { type: 'topic' } }} onValues={onValues} />);
      await user.type(screen.getByLabelText('Topic'), 'a/b');
      expect(onValues).toHaveBeenLastCalledWith({ topic: 'a/b' });
      await user.clear(screen.getByLabelText('Topic'));
      expect(onValues).toHaveBeenLastCalledWith({});
    });

    it('number: stores numbers, empties to no value, carries min max step', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ n: { type: 'number', int: true, min: 1, max: 9 } }} onValues={onValues} />);
      const input = screen.getByLabelText('N');
      expect(input).toHaveAttribute('min', '1');
      expect(input).toHaveAttribute('max', '9');
      expect(input).toHaveAttribute('step', '1');
      await user.type(input, '7');
      expect(onValues).toHaveBeenLastCalledWith({ n: 7 });
      await user.clear(input);
      expect(onValues).toHaveBeenLastCalledWith({});
    });

    it('bool: a switch', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ on: { type: 'bool', hint: 'Turn it on' } }} onValues={onValues} />);
      expect(screen.getByRole('switch', { name: /On/ })).toHaveAttribute('aria-checked', 'false');
      await user.click(screen.getByRole('switch'));
      expect(onValues).toHaveBeenLastCalledWith({ on: true });
      expect(screen.getByText('Turn it on')).toBeInTheDocument();
    });

    it('enum: shows option labels and stores the option itself, so numbers stay numbers', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ level: { type: 'enum', options: [1, 2, 'x'], option_labels: { 1: 'One' } } }} onValues={onValues} />);
      expect(screen.getByRole('option', { name: 'One' })).toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText('Level'), 'One');
      expect(onValues).toHaveBeenLastCalledWith({ level: 1 });
      await user.selectOptions(screen.getByLabelText('Level'), 'x');
      expect(onValues).toHaveBeenLastCalledWith({ level: 'x' });
    });

    it('enum: selects the stored value', () => {
      render(<Harness schema={{ level: { type: 'enum', options: ['a', 'b'] } }} initial={{ level: 'b' }} />);
      expect(screen.getByLabelText('Level')).toHaveValue('1');
    });

    it('duration: converts between the unit and milliseconds', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ hold: { type: 'duration' } }} initial={{ hold: 90000 }} onValues={onValues} />);
      expect(screen.getByLabelText('Hold')).toHaveValue(90);
      expect(screen.getByLabelText('Unit')).toHaveValue('s');
      await user.selectOptions(screen.getByLabelText('Unit'), 'min');
      expect(screen.getByLabelText('Hold')).toHaveValue(1.5);
      await user.clear(screen.getByLabelText('Hold'));
      await user.type(screen.getByLabelText('Hold'), '2');
      expect(onValues).toHaveBeenLastCalledWith({ hold: 120000 });
    });

    it('weekdays: toggles days, kept in order', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ days: { type: 'weekdays' } }} onValues={onValues} />);
      await user.click(screen.getByRole('button', { name: 'Wed' }));
      await user.click(screen.getByRole('button', { name: 'Mon' }));
      expect(onValues).toHaveBeenLastCalledWith({ days: [1, 3] });
      expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
      await user.click(screen.getByRole('button', { name: 'Wed' }));
      expect(onValues).toHaveBeenLastCalledWith({ days: [1] });
    });

    it('secret: keeps a stored value when left empty and replaces it when typed', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ password: { type: 'secret' } }} initial={{ password: { $secret: true } }} onValues={onValues} />);
      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('placeholder', '(unchanged)');
      await user.type(input, 'x');
      expect(onValues).toHaveBeenLastCalledWith({ password: 'x' });
      await user.clear(input);
      expect(onValues).toHaveBeenLastCalledWith({ password: undefined });
    });

    it('secret: an emptied field that held the marker keeps the marker', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ password: { type: 'secret' } }} initial={{ password: { $secret: true } }} onValues={onValues} />);
      await user.click(screen.getByLabelText('Password'));
      await user.keyboard('a{Backspace}');
      expect(onValues).toHaveBeenLastCalledWith({ password: undefined });
    });

    it('json: parses as you type and flags text that does not parse', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ body: { type: 'json' } }} onValues={onValues} />);
      const area = screen.getByLabelText('Body');
      await user.click(area);
      await user.paste('{"a":1}');
      expect(onValues).toHaveBeenLastCalledWith({ body: { a: 1 } });
      await user.clear(area);
      await user.paste('{oops');
      expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
      expect(onValues).toHaveBeenLastCalledWith({ body: undefined });
    });

    it('code: an editor for the code, with its language', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      const { container } = render(<Harness schema={{ code: { type: 'code', lang: 'js', label: 'Script' } }} initial={{ code: 'return msg;' }} onValues={onValues} />);
      expect(container.querySelector('[data-kui-codeeditor][data-language="js"]')).not.toBeNull();
      const area = within(container).getByRole('textbox');
      expect(area).toHaveValue('return msg;');
      await user.type(area, '!');
      expect(onValues).toHaveBeenLastCalledWith({ code: 'return msg;!' });
    });

    it('text and template: a textarea', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ body: { type: 'template' } }} onValues={onValues} />);
      await user.type(screen.getByLabelText('Body'), 'x');
      expect(onValues).toHaveBeenLastCalledWith({ body: 'x' });
    });

    it('suggestions: a datalist for the field', () => {
      const { container } = render(<Harness schema={{ channel: { type: 'string', suggest: ['auto', '1'] } }} />);
      expect(screen.getByLabelText('Channel')).toHaveAttribute('list', 'param-channel-suggest');
      expect(container.querySelectorAll('datalist#param-channel-suggest option')).toHaveLength(2);
    });
  });

  describe('source, ref and list fields', () => {
    const choices: ParamChoices = {
      brokers: [{ value: 'lan', label: 'LAN broker' }, { value: 'cloud', label: 'Cloud' }],
      kinds: [{ value: 'up', label: 'Link up' }, { value: 'down', label: 'Link down' }],
    };
    it('source: a select of the host list', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ broker: { type: 'source', source: 'brokers' } }} choices={choices} onValues={onValues} />);
      await user.selectOptions(screen.getByLabelText('Broker'), 'Cloud');
      expect(onValues).toHaveBeenLastCalledWith({ broker: 'cloud' });
      await user.selectOptions(screen.getByLabelText('Broker'), '—');
      expect(onValues).toHaveBeenLastCalledWith({});
    });
    it('source: shows a saved value the list no longer has', () => {
      render(<Harness schema={{ broker: { type: 'source', source: 'brokers' } }} choices={choices} initial={{ broker: 'old' }} />);
      expect(screen.getByRole('option', { name: 'old (not available now)' })).toBeInTheDocument();
      expect(screen.getByLabelText('Broker')).toHaveValue('__missing__');
    });
    it('source with free: offers Other and a text field', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ broker: { type: 'source', source: 'brokers', free: true } }} choices={choices} onValues={onValues} />);
      await user.selectOptions(screen.getByLabelText('Broker'), 'Other…');
      await user.type(screen.getByLabelText('Other value'), 'mine');
      expect(onValues).toHaveBeenLastCalledWith({ broker: 'mine' });
    });
    it('source without a list from the host is a plain text field', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ broker: { type: 'source', source: 'brokers' } }} onValues={onValues} />);
      await user.type(screen.getByRole('textbox', { name: 'Broker' }), 'x');
      expect(onValues).toHaveBeenLastCalledWith({ broker: 'x' });
    });
    it('multiple source: checkboxes', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ brokers: { type: 'source', source: 'brokers', multiple: true } }} choices={choices} onValues={onValues} />);
      await user.click(screen.getByRole('checkbox', { name: 'Cloud' }));
      await user.click(screen.getByRole('checkbox', { name: 'LAN broker' }));
      expect(onValues).toHaveBeenLastCalledWith({ brokers: ['cloud', 'lan'] });
      await user.click(screen.getByRole('checkbox', { name: 'Cloud' }));
      expect(onValues).toHaveBeenLastCalledWith({ brokers: ['lan'] });
    });
    it('list of enum items: checkboxes with option labels', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ kinds: { type: 'list', items: { type: 'enum', options: ['up', 'down'], option_labels: { up: 'Link up' } } } }} onValues={onValues} />);
      await user.click(screen.getByRole('checkbox', { name: 'Link up' }));
      expect(onValues).toHaveBeenLastCalledWith({ kinds: ['up'] });
      expect(screen.getByRole('checkbox', { name: 'down' })).toBeInTheDocument();
    });
    it('list of anything else: comma separated text', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ from: { type: 'list', items: { type: 'string' } } }} onValues={onValues} />);
      await user.type(screen.getByLabelText('From'), 'a, b');
      expect(onValues).toHaveBeenLastCalledWith({ from: ['a', 'b'] });
    });
    it('list of numbers: parses the numbers', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={{ pins: { type: 'list', items: { type: 'number' } } }} onValues={onValues} />);
      await user.type(screen.getByLabelText('Pins'), '1, 2,x');
      expect(onValues).toHaveBeenLastCalledWith({ pins: [1, 2] });
    });
  });

  describe('value fields', () => {
    const schema: Record<string, ParamSpec> = { v: { type: 'value', label: 'Compare with' } };
    it('starts as text, switches kind with a fitting default', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={schema} onValues={onValues} />);
      expect(screen.getByLabelText('Type')).toHaveValue('str');
      await user.selectOptions(screen.getByLabelText('Type'), 'Variable');
      expect(onValues).toHaveBeenLastCalledWith({ v: { kind: 'path', v: 'msg.payload' } });
      expect(screen.getByLabelText('Value')).toHaveValue('msg.payload');
    });
    it('number kind stores a number', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={schema} initial={{ v: { kind: 'num', v: 0 } }} onValues={onValues} />);
      await user.clear(screen.getByLabelText('Value'));
      await user.type(screen.getByLabelText('Value'), '5');
      expect(onValues).toHaveBeenLastCalledWith({ v: { kind: 'num', v: 5 } });
    });
    it('bool kind is a switch, now kind needs no value', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      const { rerender } = render(<Harness schema={schema} initial={{ v: { kind: 'bool', v: true } }} onValues={onValues} />);
      await user.click(screen.getByRole('switch'));
      expect(onValues).toHaveBeenLastCalledWith({ v: { kind: 'bool', v: false } });
      rerender(<Harness key="now" schema={schema} initial={{ v: { kind: 'now' } }} />);
      expect(screen.getByText('The time the message arrives.')).toBeInTheDocument();
    });
    it('reads a plain string as text', () => {
      render(<Harness schema={schema} initial={{ v: 'plain' }} />);
      expect(screen.getByLabelText('Value')).toHaveValue('plain');
    });
  });

  describe('rules fields', () => {
    const schema: Record<string, ParamSpec> = {
      rules: {
        type: 'rules', max: 2,
        items: { op: { type: 'enum', options: ['eq', 'true'], default: 'eq' }, value: { type: 'string', when: { param: 'op', not: ['true'] } } },
      },
    };
    it('adds rows up to max, removes them, and edits the fields of a row', async () => {
      const user = userEvent.setup();
      const onValues = vi.fn();
      render(<Harness schema={schema} onValues={onValues} />);
      await user.click(screen.getByRole('button', { name: /Add rule/ }));
      await user.click(screen.getByRole('button', { name: /Add rule/ }));
      expect(onValues).toHaveBeenLastCalledWith({ rules: [{ op: 'eq' }, { op: 'eq' }] });
      expect(screen.queryByRole('button', { name: /Add rule/ })).not.toBeInTheDocument();
      await user.type(screen.getAllByLabelText('Value')[1], 'x');
      expect(onValues).toHaveBeenLastCalledWith({ rules: [{ op: 'eq' }, { op: 'eq', value: 'x' }] });
      await user.selectOptions(screen.getAllByLabelText('Op')[0], 'true');
      expect(screen.getAllByLabelText('Value')).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Remove rule 1' }));
      expect(onValues).toHaveBeenLastCalledWith({ rules: [{ op: 'eq', value: 'x' }] });
    });

    it('a row field with its own suggest gets a datalist of its own', () => {
      const rows: Record<string, ParamSpec> = { to: { type: 'rules', items: { value: { type: 'string', suggest: ['ops', 'dev'] } } } };
      const { container } = render(<Harness schema={rows} initial={{ to: [{}, {}] }} />);
      const [first, second] = screen.getAllByLabelText('Value');
      expect(first).toHaveAttribute('list', 'param-to-0-value-suggest');
      expect(second).toHaveAttribute('list', 'param-to-1-value-suggest');
      expect(container.querySelectorAll('datalist#param-to-1-value-suggest option')).toHaveLength(2);
    });

    it('suggest: the host suggests per row from the row\'s other fields; an empty list turns a field\'s suggestions off', async () => {
      const user = userEvent.setup();
      const rows: Record<string, ParamSpec> = {
        to: { type: 'rules', items: { kind: { type: 'enum', options: ['user', 'role', 'email'], default: 'user' }, value: { type: 'string' } } },
        subject: { type: 'string', suggest: ['Alarm'] },
      };
      const suggest = vi.fn<ParamSuggest>(({ key, row }) => {
        if (key === 'subject') return [];
        if (!row || key !== 'value') return undefined;
        if (row.values.kind === 'role') return ['ADMIN', 'OWNER'];
        if (row.values.kind === 'email') return [];
        return [{ value: 'u1', label: 'Ayşe' }];
      });
      const { container } = render(<Harness schema={rows} initial={{ to: [{ kind: 'user' }, { kind: 'role' }, { kind: 'email' }] }} suggest={suggest} />);
      const values = screen.getAllByLabelText('Value');
      expect(values[0]).toHaveAttribute('list', 'param-to-0-value-suggest');
      const user0 = container.querySelector('datalist#param-to-0-value-suggest option');
      expect(user0).toHaveAttribute('value', 'u1');
      expect(user0).toHaveAttribute('label', 'Ayşe');
      expect(container.querySelectorAll('datalist#param-to-1-value-suggest option')).toHaveLength(2);
      expect(values[2]).not.toHaveAttribute('list');
      expect(screen.getByLabelText('Subject')).not.toHaveAttribute('list');
      expect(suggest).toHaveBeenCalledWith(expect.objectContaining({ key: 'value', row: { param: 'to', index: 1, values: { kind: 'role' } }, values: expect.objectContaining({ to: expect.any(Array) }) }));
      // a row whose kind changes is offered the other list
      await user.selectOptions(screen.getAllByLabelText('Kind')[2], 'role');
      expect(container.querySelectorAll('datalist#param-to-2-value-suggest option')).toHaveLength(2);
    });
  });

  describe('validation', () => {
    it('shows range and pattern problems at once, and required ones when asked', () => {
      const schema: Record<string, ParamSpec> = {
        n: { type: 'number', max: 5 }, code: { type: 'string', pattern: '^[a-z]+$' }, must: { type: 'string', required: true },
      };
      const { rerender } = render(<Harness schema={schema} initial={{ n: 9, code: 'AB' }} />);
      expect(screen.getByText('N must be at most 5.')).toBeInTheDocument();
      expect(screen.getByText('Code has an invalid format.')).toBeInTheDocument();
      expect(screen.queryByText('Must is required.')).not.toBeInTheDocument();
      rerender(<Harness key="r" schema={schema} initial={{ n: 9, code: 'AB' }} showRequired />);
      expect(screen.getByText('Must is required.')).toBeInTheDocument();
    });
    it('marks required fields', () => {
      render(<Harness schema={{ must: { type: 'string', required: true } }} />);
      expect(screen.getByText('(required)')).toBeInTheDocument();
    });
  });

  it('is read only when asked: nothing can change', async () => {
    const user = userEvent.setup();
    const onValues = vi.fn();
    render(<Harness readOnly schema={{ a: { type: 'string' }, b: { type: 'bool' }, c: { type: 'enum', options: ['x', 'y'] }, d: { type: 'weekdays' } }} onValues={onValues} />);
    expect(screen.getByLabelText(/^A/)).toHaveAttribute('readonly');
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByLabelText('C')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Mon' }));
    expect(onValues).not.toHaveBeenCalled();
  });
});

describe('ParamForm: messages', () => {
  const de = {
    ...DEFAULT_MESSAGES,
    formWeekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], formUnit: 'Einheit', formUnchanged: '(unverändert)', formSecretStored: 'Ein Wert ist gespeichert.',
    formValueType: 'Art', formKindNow: 'Aktuelle Zeit', formValueNow: 'Der Zeitpunkt, zu dem die Nachricht ankommt.', formKindNum: 'Zahl',
    formAddRule: 'Regel hinzufügen', formRule: (n: number) => `Regel ${n}`, formRemoveRule: (n: number) => `Regel ${n} entfernen`,
    formComma: 'Kommagetrennt', formInvalidJson: (r: string) => `Ungültiges JSON: ${r}`, formChoose: 'Wählen…',
  };
  const show = (schema: Record<string, ParamSpec>, initial: Record<string, unknown> = {}) =>
    render(<MessagesProvider value={de}><Harness schema={schema} initial={initial} /></MessagesProvider>);

  it('translates weekdays, the duration unit, the secret hint and a list hint', () => {
    show({ days: { type: 'weekdays' }, wait: { type: 'duration' }, key: { type: 'secret' }, tags: { type: 'list', items: { type: 'string' } } }, { key: { $secret: true } });
    expect(screen.getByRole('button', { name: 'Mo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'So' })).toBeInTheDocument();
    expect(screen.getByLabelText('Einheit')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('(unverändert)')).toBeInTheDocument();
    expect(screen.getByText('Ein Wert ist gespeichert.')).toBeInTheDocument();
    expect(screen.getByText('Kommagetrennt')).toBeInTheDocument();
  });
  it('translates a value field and a rules field, with a message left out staying English', async () => {
    const user = userEvent.setup();
    show({ v: { type: 'value', label: 'Compare with' }, r: { type: 'rules', items: { op: { type: 'string', label: 'Op' } } } },
      { v: { kind: 'now' }, r: [{ op: 'a' }] });
    expect(screen.getByLabelText('Art')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Art')).getByRole('option', { name: 'Aktuelle Zeit' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Art')).getByRole('option', { name: 'Zahl' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Art')).getByRole('option', { name: 'Text' })).toBeInTheDocument(); // not given
    expect(screen.getByText('Der Zeitpunkt, zu dem die Nachricht ankommt.')).toBeInTheDocument();
    expect(screen.getByText('Regel 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regel 1 entfernen' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Regel hinzufügen' }));
    expect(screen.getByText('Regel 2')).toBeInTheDocument();
  });
  it('translates the JSON error', async () => {
    const user = userEvent.setup();
    show({ j: { type: 'json', label: 'Data' } });
    await user.type(screen.getByLabelText('Data'), '{{');
    expect(screen.getByText(/^Ungültiges JSON: /)).toBeInTheDocument();
  });
});

describe('ParamForm: the words of a field error', () => {
  it('uses paramIssueText of the messages in force', () => {
    const bundle = { ...DEFAULT_MESSAGES, paramIssueText: (code: string, label: string, limit?: number) => `${label}: ${code} ${limit ?? ''} (de)`.trim() };
    render(<MessagesProvider value={bundle as never}><Harness schema={{ n: { type: 'number', min: 5, label: 'Menge' } }} initial={{ n: 1 }} /></MessagesProvider>);
    expect(screen.getByText('Menge: min 5 (de)')).toBeInTheDocument();
  });
});

describe('ParamForm: a script field', () => {
  it('shows the signature line over the code of a script with the API, read only, and not over other code', () => {
    render(<Harness schema={{ code: { type: 'code', lang: 'js', api: 'automation-script', label: 'Code' }, other: { type: 'code', lang: 'js', label: 'Other' } }} />);
    const lines = screen.getAllByTestId('script-signature');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveTextContent('msg, node, context, flow, global, env');
    expect(lines[0]).toHaveTextContent('"label"');
    expect(lines[0].tagName).toBe('P');
    expect(screen.getByTestId('script-signature').nextElementSibling).not.toBeNull();
  });
  it('words its label from the messages', () => {
    render(<MessagesProvider value={{ ...DEFAULT_MESSAGES, scriptSignatureLabel: 'Was das Skript bekommt' }}><Harness schema={{ code: { type: 'code', lang: 'js', api: 'automation-script' } }} /></MessagesProvider>);
    expect(screen.getByTestId('script-signature')).toHaveAttribute('aria-label', 'Was das Skript bekommt');
  });
});
