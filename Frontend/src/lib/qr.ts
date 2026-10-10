import QRCode from 'qrcode';

/**
 * Generates an SVG string representation of a QR code.
 */
export async function generateQrSvg(text: string): Promise<string> {
  if (!text || !text.trim()) {
    text = 'SKYPASS:v1:empty';
  }
  try {
    const svg = await QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#0a1317',
        light: '#ffffff',
      },
    });
    return svg;
  } catch (err) {
    console.error('Failed to generate QR SVG:', err);
    return `<svg viewBox="0 0 100 100" class="w-full h-full" fill="currentColor"><rect width="100" height="100" fill="#f4f4f5"/><text x="50" y="50" text-anchor="middle" font-size="10" fill="#71717a">QR Error</text></svg>`;
  }
}

/**
 * Generates a base64 Data URL (image/png) for a QR code.
 */
export async function generateQrDataUrl(
  text: string,
  options?: { width?: number; margin?: number; color?: { dark?: string; light?: string } }
): Promise<string> {
  if (!text || !text.trim()) {
    text = 'SKYPASS:v1:empty';
  }
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      margin: options?.margin ?? 1,
      width: options?.width ?? 320,
      color: {
        dark: options?.color?.dark ?? '#0a1317',
        light: options?.color?.light ?? '#ffffff',
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR Data URL:', err);
    // Return a 1x1 transparent png or empty
    return '';
  }
}
