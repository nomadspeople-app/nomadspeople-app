/**
 * PrivacyPage — renders the canonical Privacy document
 * from `lib/legal/content`. Single source of truth shared
 * with the mobile app's LegalScreen, so the wording on the
 * App Store-listed Privacy URL ALWAYS matches what users
 * see in-app. App Store reviewers spot-check this; drift
 * between the two used to be a soft rejection risk.
 */
import { PRIVACY } from '../../../lib/legal/content';
import LegalDocumentPage from './_LegalDocumentPage';

export default function PrivacyPage() {
  return <LegalDocumentPage doc={PRIVACY} />;
}
