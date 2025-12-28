import { validateAndNormalizeRecipients } from '../components/EmailExportModal';

function test(name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`failed - ${name}`);
    throw e;
  }
}

test('valid single email', () => {
  const res = validateAndNormalizeRecipients('user@example.com');
  if (res.error) throw new Error('should be valid');
  if (res.recipients.length !== 1) throw new Error('expected one recipient');
});

test('multiple separators and duplicates', () => {
  const res = validateAndNormalizeRecipients('a@example.com, b@example.com\na@example.com');
  if (res.error) throw new Error('should be valid');
  if (res.recipients.length !== 2) throw new Error('expected two unique recipients');
});

test('invalid email errors', () => {
  const res = validateAndNormalizeRecipients('bad, also@bad');
  if (!res.error) throw new Error('expected error for invalid emails');
});

test('too many recipients errors', () => {
  const many = Array.from({ length: 12 }).map((_, i) => `u${i}@ex.com`).join(',');
  const res = validateAndNormalizeRecipients(many);
  if (!res.error) throw new Error('expected error for too many recipients');
});

test('empty string error', () => {
  const res = validateAndNormalizeRecipients('   ');
  if (!res.error) throw new Error('expected error when no recipients');
});
