import { colorField, opt, rangesFields, since } from '../settings/packs';
import type { SettingsTemplate } from '../settings/types';
import type { BuiltinKindSpec } from '../kind';
import { safeModelUrlsRule } from '../views/content-logic';

/** `viewer.model`: IFC/BIM models in a 3D viewer (kui-viewer), with bound table rows as live sensor markers. */
export const VIEWER_MODEL: SettingsTemplate = {
  id: 'builtin:viewer.model',
  version: 1,
  namespace: '',
  label: '3D model',
  format: false,
  exportable: true,
  cardDefaults: { padding: 0 },
  groups: [
    { id: 'models', label: 'Models', tab: 'Display', since: 1 },
    { id: 'columns', label: 'Sensor columns', tab: 'Data', since: 1 },
    { id: 'markers', label: 'Sensor markers', tab: 'Display', since: 1 },
    { id: 'colour', label: 'Marker colour', tab: 'Display', since: 1 },
    { id: 'legend', label: 'Legend', tab: 'Display', since: 1 },
    { id: 'tooltip', label: 'Labels and tooltips', tab: 'Display', since: 1 },
    { id: 'scene', label: 'Scene', tab: 'Display', since: 1 },
    { id: 'camera', label: 'Camera', tab: 'Behaviour', since: 1 },
  ],
  fields: since(1, {
    models: {
      label: 'Models', type: 'repeater', group: 'models', max: 8, value: [],
      description: 'IFC files loaded together as one federated scene, in this order. An internal path (/…) or an https address '
        + '(the other site must allow it with CORS).',
      fields: {
        url: { label: 'Address', type: 'url', maxLength: 2048, required: true, placeholder: '/samples/plant/Plant-Structure.ifc' },
        label: { label: 'Name', type: 'text', maxLength: 60, placeholder: 'Structure' },
        visible: { label: 'Show', type: 'boolean', value: true },
      },
    },
    idColumn: {
      label: 'Sensor id column', type: 'data-key', slot: 'sensors', value: 'id', group: 'columns',
      description: 'Identifies the sensor. Empty = the row number.',
    },
    labelColumn: { label: 'Label column', type: 'data-key', slot: 'sensors', value: 'label', group: 'columns', description: 'The sensor\'s name: its tooltip title and its label in the model.' },
    xColumn: { label: 'X column', type: 'data-key', slot: 'sensors', value: 'x', required: true, group: 'columns' },
    yColumn: { label: 'Y column', type: 'data-key', slot: 'sensors', value: 'y', required: true, group: 'columns' },
    zColumn: { label: 'Z column', type: 'data-key', slot: 'sensors', value: 'z', required: true, group: 'columns' },
    coordinates: {
      label: 'Coordinates are', type: 'select', value: 'z-up', group: 'columns', required: true, advanced: true,
      options: [opt('z-up', 'Model coordinates (Z up, as in IFC)'), opt('y-up', 'Scene coordinates (Y up)')],
      description: 'In metres. Model coordinates are what an IFC authoring tool shows; rows without three numbers are not placed.',
    },
    valueColumn: {
      label: 'Reading column', type: 'data-key', slot: 'sensors', value: 'value', group: 'columns',
      description: 'The live value shown on the marker and in its tooltip; colour ranges apply to it.',
    },
    unitColumn: { label: 'Unit column', type: 'data-key', slot: 'sensors', value: 'unit', group: 'columns', advanced: true },
    markerSize: { label: 'Marker size (px)', type: 'number', min: 8, max: 40, value: 14, group: 'markers' },
    pulseAlarms: {
      label: 'Pulse markers in an alarm colour', type: 'boolean', value: true, group: 'markers',
      description: 'A marker whose colour is the error tone draws the eye with a soft pulse.',
    },
    colorBy: {
      label: 'Colour from', type: 'select', display: 'segmented', value: 'column', group: 'colour', required: true,
      options: [opt('fixed', 'One colour'), opt('column', 'A status column'), opt('ranges', 'Ranges on the reading')],
    },
    markerColor: colorField('Marker colour', 'colour', 'var(--primary)', {
      description: 'Also used when a row has no colour of its own.',
    }),
    colorColumn: {
      label: 'Status column', type: 'data-key', slot: 'sensors', value: 'status', group: 'colour', showIf: { colorBy: 'column' },
      description: 'Its value picks the colour: a value named below, a status word (Normal, Warning, Alarm…), a colour name (success, warning, error, info, neutral, primary) or a CSS colour.',
    },
    valueColors: {
      label: 'Status colours', type: 'repeater', group: 'colour', max: 20, value: [], showIf: { colorBy: 'column' },
      description: 'Maps a value of the status column (case does not matter) to a colour and a legend label.',
      fields: {
        value: { label: 'Value', type: 'text', maxLength: 80, required: true, placeholder: 'Alarm' },
        color: { label: 'Colour', type: 'color', value: 'var(--error)' },
        label: { label: 'Shown as', type: 'text', maxLength: 40, placeholder: 'The value' },
      },
    },
    ...rangesFields('The first range the reading falls in colours the marker.', 'colour'),
    legend: {
      label: 'Show a legend', type: 'boolean', value: true, group: 'legend',
      description: 'What each colour means, with a count per status. Hidden with one colour.',
    },
    legendPosition: {
      label: 'Legend corner', type: 'select', value: 'bottomleft', group: 'legend', required: true, showIf: { legend: true },
      options: [opt('bottomleft', 'Bottom left'), opt('bottomright', 'Bottom right'), opt('topleft', 'Top left'), opt('topright', 'Top right')],
    },
    showSensorLabels: { label: 'Show labels in the model', type: 'boolean', value: true, group: 'tooltip' },
    labelContent: {
      label: 'Label shows', type: 'select', display: 'segmented', value: 'both', group: 'tooltip', required: true, showIf: { showSensorLabels: true },
      options: [opt('label', 'Name'), opt('value', 'Reading'), opt('both', 'Name and reading')],
    },
    tooltipTrigger: {
      label: 'Open tooltips on', type: 'select', display: 'segmented', value: 'hover', group: 'tooltip', required: true,
      options: [opt('hover', 'Hover'), opt('click', 'Click'), opt('none', 'Never')],
    },
    tooltipColumns: {
      label: 'Tooltip fields', type: 'data-key', slot: 'sensors', multiple: true, max: 6, value: [], group: 'tooltip',
      description: 'Shown as label / value rows under the reading, titled and formatted as the query declares them.',
    },
    background: colorField('Background', 'scene', undefined, {
      description: 'Behind the model. Empty = follows the theme (light or dark with the app).',
    }),
    showNavCube: { label: 'Show the view cube', type: 'boolean', value: true, group: 'scene', description: 'Click a face to look from that side.' },
    showGrid: { label: 'Show a ground grid', type: 'boolean', value: false, group: 'scene' },
    cameraPreset: {
      label: 'Start view', type: 'select', display: 'segmented', value: 'iso', group: 'camera', required: true,
      options: [opt('iso', 'Isometric'), opt('top', 'Top'), opt('front', 'Front')],
    },
    autoFitOnLoad: {
      label: 'Fit the view to the models when they load', type: 'boolean', value: true, group: 'camera',
      description: 'Off: the camera stays where the viewer starts it.',
    },
    interactive: {
      label: 'Let viewers orbit, pan and zoom', type: 'boolean', value: true, group: 'camera',
      description: 'Off: the view is locked to the start view (markers still show their tooltips).',
    },
    scrollZoom: {
      label: 'Zoom with the mouse wheel', type: 'boolean', value: false, group: 'camera', showIf: { interactive: true },
      description: 'Off: the wheel scrolls the board past the model; drag to orbit, right-drag to pan.',
    },
  }),
  rules: [safeModelUrlsRule('models')],
  migrations: [],
};

export const VIEWER_MODEL_KIND: BuiltinKindSpec = {
  type: 'viewer.model',
  label: '3D model',
  category: 'Maps & Location',
  group: 'viewer',
  description: 'IFC/BIM models in a 3D viewer, with bound table rows as live sensor markers.',
  icon: 'fas fa-cube',
  defaultW: 6,
  defaultH: 8,
  slots: [{ key: 'sensors', label: 'Sensors', shape: 'table', required: false }],
  template: VIEWER_MODEL,
};
