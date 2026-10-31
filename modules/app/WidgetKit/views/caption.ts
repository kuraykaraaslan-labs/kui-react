// The caption a view draws over its content (a value's label, a state's, a control's), and when it is left out.

/**
 * `text`, unless it only repeats the card's title drawn in the header above it ("Active alarms" over "Active alarms" cost a line in a
 * small card): compared trimmed and without case. A different caption, or a card whose header does not show its title, keeps it.
 */
export function captionOf(text: string | null | undefined, view: { title?: string; titleShown?: boolean }): string | undefined {
  if (!text) return text ?? undefined;
  if (!view.titleShown || !view.title) return text;
  return text.trim().toLocaleLowerCase() === view.title.trim().toLocaleLowerCase() ? undefined : text;
}
