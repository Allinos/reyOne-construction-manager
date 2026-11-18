// Minimal EXIF reader: returns the photo's original capture time (as an ISO
// string, interpreted in the device's local time zone) from a JPEG's
// DateTimeOriginal / DateTimeDigitized / DateTime tags, or null. Reads only the
// first 128 KB of the file, so it is cheap even for large camera photos.
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_ORIGINAL = 0x9003;
const TAG_DIGITIZED = 0x9004;

function parseExifDate(str) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(str || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return null;
  return d.toISOString();
}

function readIfd(view, tiff, offset, little, wanted) {
  const out = {};
  if (offset + 2 > view.byteLength) return out;
  const count = view.getUint16(offset, little);
  for (let i = 0; i < count; i += 1) {
    const e = offset + 2 + i * 12;
    if (e + 12 > view.byteLength) break;
    const tag = view.getUint16(e, little);
    if (!wanted.includes(tag)) continue;
    const type = view.getUint16(e + 2, little);
    const n = view.getUint32(e + 4, little);
    if (type === 2) {
      // ASCII string, stored at an offset when longer than 4 bytes.
      const start = n > 4 ? tiff + view.getUint32(e + 8, little) : e + 8;
      let s = '';
      for (let k = 0; k < n - 1 && start + k < view.byteLength; k += 1) s += String.fromCharCode(view.getUint8(start + k));
      out[tag] = s;
    } else if (type === 4) {
      out[tag] = view.getUint32(e + 8, little);
    }
  }
  return out;
}

export async function readPhotoDate(file) {
  try {
    if (!file || !/jpe?g$/i.test(file.type || file.name || '')) return null;
    const buf = await file.slice(0, 131072).arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xffd8) return null;
    let p = 2;
    while (p + 4 < view.byteLength) {
      const marker = view.getUint16(p);
      const len = view.getUint16(p + 2);
      if (marker === 0xffe1 && view.getUint32(p + 4) === 0x45786966) {
        const tiff = p + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const ifd0 = tiff + view.getUint32(tiff + 4, little);
        const base = readIfd(view, tiff, ifd0, little, [TAG_DATETIME, TAG_EXIF_IFD]);
        let exif = {};
        if (base[TAG_EXIF_IFD]) exif = readIfd(view, tiff, tiff + base[TAG_EXIF_IFD], little, [TAG_ORIGINAL, TAG_DIGITIZED]);
        return parseExifDate(exif[TAG_ORIGINAL]) || parseExifDate(exif[TAG_DIGITIZED]) || parseExifDate(base[TAG_DATETIME]);
      }
      if ((marker & 0xff00) !== 0xff00) break;
      p += 2 + len;
    }
  } catch {
    /* unreadable — no date */
  }
  return null;
}
