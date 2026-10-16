import { notFound } from 'next/navigation';
import { EngineDev } from './EngineDev';

/** Development-only page that exercises every engine feature for manual verification. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <EngineDev />;
}
