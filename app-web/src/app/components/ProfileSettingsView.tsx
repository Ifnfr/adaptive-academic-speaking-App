"use client";

import { SettingsView } from "./SettingsView";
import type { SettingsViewProps } from "./SettingsView";

export {
  getProfileLanguagePreferenceState,
  buildProfileSettingsPreferencesPatch,
} from "./SettingsView";

export type ProfileSettingsViewProps = SettingsViewProps;

export function ProfileSettingsView(props: ProfileSettingsViewProps) {
  return <SettingsView {...props} />;
}
