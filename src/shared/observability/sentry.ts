import * as Sentry from '@sentry/react-native';
import { scrubBreadcrumb, scrubEvent } from './scrub';

/** Sentry solo se enciende con DSN (EXPO_PUBLIC_SENTRY_DSN, público por diseño). Sin DSN no hace nada. */
export function initSentry(dsn: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN): boolean {
  if (!dsn) return false;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
  return true;
}
