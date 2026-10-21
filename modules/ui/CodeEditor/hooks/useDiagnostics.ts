'use client';
// modules/ui/CodeEditor/hooks/useDiagnostics.ts
//
// Diagnostics (lint / syntax markers), M3: the markers in reading order, for
// the list under the field. The textarea engine draws them in the gutter and
// as tinted lines itself. For CM6 this is where a @codemirror/lint
// setDiagnostics effect would be dispatched; for Monaco setModelMarkers.

import { useMemo } from 'react';
import type { Marker } from '../types';

export function sortMarkers(markers: readonly Marker[] | undefined): Marker[] {
  return [...(markers ?? [])].sort((a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
}

export function useDiagnostics(markers: Marker[] | undefined): Marker[] {
  return useMemo(() => sortMarkers(markers), [markers]);
}
