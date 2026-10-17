export type BuddyOption = {
  id: string;
  name: string;
  emoji: string;
  accent: string;
  label: string;
};

export const buddyOptions: BuddyOption[] = [
  { id: 'Bunny', name: 'Bunny', emoji: '🐰', accent: 'bg-primary-fixed/40', label: 'Bunny' },
  { id: 'Cat', name: 'Cat', emoji: '🐱', accent: 'bg-tertiary-fixed/30', label: 'Cat' },
  { id: 'Bear', name: 'Bear', emoji: '🐻', accent: 'bg-surface-container-high', label: 'Bear' },
  { id: 'Fox', name: 'Fox', emoji: '🦊', accent: 'bg-secondary-fixed/30', label: 'Fox' },
  { id: 'Panda', name: 'Panda', emoji: '🐼', accent: 'bg-secondary-container/40', label: 'Panda' },
  { id: 'Penguin', name: 'Penguin', emoji: '🐧', accent: 'bg-primary-fixed/30', label: 'Penguin' },
  { id: 'Frog', name: 'Frog', emoji: '🐸', accent: 'bg-secondary-container/40', label: 'Frog' },
  { id: 'Duck', name: 'Duck', emoji: '🦆', accent: 'bg-tertiary-fixed/30', label: 'Duck' },
];

export function getBuddyOption(id: string | null | undefined): BuddyOption | null {
  return buddyOptions.find((buddy) => buddy.id === id) ?? null;
}