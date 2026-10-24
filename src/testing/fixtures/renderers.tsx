import type { ReactElement } from 'react';
import { AppShell } from '../../ui/layout/AppShell';

export const FIXTURE_RENDERERS: Record<string, () => ReactElement> = {
  'shell/empty': () => <AppShell />,
};
