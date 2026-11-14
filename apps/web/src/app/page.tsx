import { redirect } from 'next/navigation';

/** Signed-out visitors are sent to sign-in by the middleware; everyone else to their workspace. */
export default function HomePage() {
  redirect('/w');
}
