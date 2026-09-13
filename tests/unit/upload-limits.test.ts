import { describe, it, expect } from 'vitest';
import {
  UPLOAD_TYPES,
  ICON_TYPES,
  PHOTO_TYPES,
  LOGO_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  acceptAttr,
  formatNames,
  uploadHint,
} from '@/lib/upload-limits';

/**
 * The file pickers and the upload route used to declare their own limits, and
 * had already drifted apart. These hold the one rule that matters: a picker may
 * be NARROWER than the server, never wider — anything wider is a file the owner
 * is invited to choose and then told they cannot use.
 */

describe('what the uploader accepts', () => {
  it('never offers a format the server will refuse', () => {
    for (const group of [ICON_TYPES, PHOTO_TYPES, LOGO_TYPES]) {
      for (const type of group) {
        expect(UPLOAD_TYPES as readonly string[]).toContain(type);
      }
    }
  });

  it('⚠️ keeps a stamp icon to formats that carry transparency', () => {
    // The icon is drawn onto the card's ground colour. A JPEG has no alpha and
    // arrives as a white rectangle around the mark, which on a brand-coloured
    // or dark card is unmissable and unexplained.
    expect(ICON_TYPES).not.toContain('image/jpeg');
    expect(ICON_TYPES).toContain('image/png');
    expect(ICON_TYPES).toContain('image/svg+xml');
  });

  it('does not offer SVG where a camera photo is wanted', () => {
    expect(PHOTO_TYPES).not.toContain('image/svg+xml');
    expect(PHOTO_TYPES).toContain('image/jpeg');
  });

  it('builds an accept attribute a file input understands', () => {
    expect(acceptAttr(ICON_TYPES)).toBe('image/png,image/svg+xml');
    // No wildcard anywhere: `image/*` is what let HEIC through to a refusal.
    for (const group of [ICON_TYPES, PHOTO_TYPES, LOGO_TYPES]) {
      expect(acceptAttr(group)).not.toContain('*');
    }
  });

  it('names formats the way a person would say them', () => {
    expect(formatNames(ICON_TYPES)).toBe('PNG o SVG');
    expect(formatNames(PHOTO_TYPES)).toBe('PNG, JPG o WEBP');
    expect(formatNames(['image/png'])).toBe('PNG');
  });

  it('puts the size limit in the hint, in the unit the error uses', () => {
    expect(uploadHint(ICON_TYPES)).toBe(`PNG o SVG · máx. ${MAX_UPLOAD_MB} MB`);
    expect(MAX_UPLOAD_BYTES).toBe(MAX_UPLOAD_MB * 1024 * 1024);
  });
});
