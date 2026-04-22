/**
 * TermsPage — renders the canonical Terms document from
 * `lib/legal/content`. Shares the same source as the mobile
 * LegalScreen (Terms tab), so wording stays identical.
 */
import { TERMS } from '../../../lib/legal/content';
import LegalDocumentPage from './_LegalDocumentPage';

export default function TermsPage() {
  return <LegalDocumentPage doc={TERMS} />;
}
