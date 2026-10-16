import { notFound } from 'next/navigation';
import { PanelsDev } from './PanelsDev';

/** Development-only page: the real AppShell hydrated with a fixture brain, for checking the panels by eye. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <PanelsDev />;
}
