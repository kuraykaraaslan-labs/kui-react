import { opt, since } from '../settings/packs';
import type { SettingsTemplate } from '../settings/types';
import type { BuiltinKindSpec } from '../kind';
import { safeMediaRule, safeSubtitlesRule } from '../views/content-logic';

/**
 * `content.video`: a video played by kui-player, from an address in the settings or from a bound
 * value (e.g. a camera's stream address on a device attribute), which wins when it is a valid one.
 * MP4 / WebM play natively; HLS (`.m3u8`) through hls.js, loaded only for an HLS source.
 */
export const CONTENT_VIDEO: SettingsTemplate = {
  id: 'builtin:content.video',
  version: 1,
  namespace: '',
  label: 'Video player',
  format: false,
  exportable: false,
  cardDefaults: { buttons: [], padding: 0 },
  groups: [
    { id: 'video', label: 'Video', tab: 'Display', since: 1 },
    { id: 'playback', label: 'Playback', tab: 'Display', since: 1 },
    { id: 'display', label: 'Display', tab: 'Display', since: 1 },
    { id: 'subtitles', label: 'Subtitles', tab: 'Display', since: 1 },
  ],
  fields: since(1, {
    src: {
      label: 'Video address', type: 'url', maxLength: 2000, placeholder: 'https://…/video.mp4 or …/stream.m3u8', group: 'video',
      description: 'MP4, WebM or an HLS stream (.m3u8); an internal path or an https / http address. A bound value, when valid, takes its place.',
    },
    poster: {
      label: 'Poster image', type: 'url', maxLength: 2000, placeholder: 'https://… or /uploads/…', group: 'video',
      description: 'Shown before the video plays.',
    },
    autoPlay: {
      label: 'Start playing on its own', type: 'boolean', value: false, group: 'playback',
      description: 'Browsers allow this only for a muted video, so it starts muted.',
    },
    startMuted: { label: 'Start muted', type: 'boolean', value: false, group: 'playback' },
    loop: { label: 'Loop', type: 'boolean', value: false, group: 'playback' },
    autoHideControls: { label: 'Hide the controls while playing', type: 'boolean', value: true, group: 'playback' },
    fit: {
      label: 'Fit', type: 'select', display: 'segmented', value: 'contain', group: 'display', required: true,
      options: [opt('contain', 'Whole video'), opt('cover', 'Fill the card')],
    },
    theme: {
      label: 'Player style', type: 'select', display: 'segmented', value: 'minimal', group: 'display', required: true, advanced: true,
      options: [opt('minimal', 'Minimal'), opt('broadcast', 'Broadcast'), opt('cinema', 'Cinema')],
    },
    showTitle: {
      label: 'Show the card title on the video', type: 'boolean', value: false, group: 'display', advanced: true,
      description: 'The player draws the title over the picture.',
    },
    subtitles: {
      label: 'Subtitle tracks', type: 'repeater', value: [], max: 12, group: 'subtitles',
      description: 'WebVTT files; the address must be an internal path or an https / http address.',
      fields: {
        label: { label: 'Label', type: 'text', maxLength: 40, required: true, placeholder: 'English' },
        srclang: { label: 'Language code', type: 'text', maxLength: 12, required: true, placeholder: 'en' },
        src: { label: 'File', type: 'text', maxLength: 2000, required: true, placeholder: '/uploads/en.vtt' },
      },
    },
  }),
  rules: [safeMediaRule('src', 'The video address'), safeMediaRule('poster', 'The poster image'), safeSubtitlesRule('subtitles')],
  migrations: [],
};

export const CONTENT_VIDEO_KIND: BuiltinKindSpec = {
  type: 'content.video',
  label: 'Video player',
  category: 'Content',
  description: 'A video or a live HLS stream, from an address or a bound value such as a camera’s stream.',
  icon: 'fas fa-circle-play',
  defaultW: 6,
  defaultH: 6,
  slots: [{ key: 'source', label: 'Video address', shape: 'scalar', required: false }],
  template: CONTENT_VIDEO,
};
