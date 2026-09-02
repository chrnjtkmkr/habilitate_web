// Shorten long activity names for display while keeping them readable.
// Removes parenthetical qualifiers and truncates at hyphens.
export function getReadableActivityName(name: string): string {
  // Remove parenthetical qualifiers: "Labeling (Tact) Familiar Objects" → "Labeling Familiar Objects"
  let result = name.replace(/\s*\([^)]+\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // If still long and has a hyphen separator, keep the part before it:
  // "PECS Phase 1 - Picture Exchange..." → "PECS Phase 1"
  if (result.length > 28) {
    const dashIdx = result.indexOf(' - ');
    if (dashIdx > 0 && dashIdx <= 28) {
      result = result.slice(0, dashIdx);
    }
  }

  return result;
}
