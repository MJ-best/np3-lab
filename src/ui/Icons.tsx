interface IconProps {
  size?: number;
}

export function IconCard({ size = 16 }: IconProps) {
  return (
    <svg class="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M7 3h7l5 5v12a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V4.5A1.5 1.5 0 0 1 7 3z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
      <path d="M9.5 3v4M12.5 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  );
}

export function IconTrash({ size = 16 }: IconProps) {
  return (
    <svg class="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 7h16M9.5 7V4.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V7M6.5 7l.8 12.2a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5L17.5 7"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function IconEdit({ size = 14 }: IconProps) {
  return (
    <svg class="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function IconEject({ size = 15 }: IconProps) {
  return (
    <svg class="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 5l7 9H5l7-9zM5 18.5h14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function IconDownload({ size = 16 }: IconProps) {
  return (
    <svg class="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function IconCamera({ size = 15 }: IconProps) {
  return (
    <svg class="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.4-2h4.2l1.4 2h2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
      <circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8" />
    </svg>
  );
}

export function IconPlus({ size = 18 }: IconProps) {
  return (
    <svg class="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

export function IconChevronDown({ size = 14 }: IconProps) {
  return (
    <svg class="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function IconCheck({ size = 16 }: IconProps) {
  return (
    <svg class="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
