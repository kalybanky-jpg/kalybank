export function wrappedFocusTargetIndex(
  currentIndex: number,
  itemCount: number,
  backwards: boolean,
): number | null {
  if (itemCount <= 0) return null;

  if (currentIndex < 0 || currentIndex >= itemCount) {
    return backwards ? itemCount - 1 : 0;
  }

  if (backwards && currentIndex === 0) return itemCount - 1;
  if (!backwards && currentIndex === itemCount - 1) return 0;

  return null;
}
