/**
 * A published bundle's checksum as Environment Manager and Deployment Manager list it: the
 * SHA-256 of its zip, as hex. The manifest sends it encrypted for Capgo's plugin (encryption
 * v2: RSA with the app's private key, PKCS#1 type 1 padding, as hex), and the plugin reads
 * it back with the public key before it checks the zip. Read back here the same way, from
 * the public key the app is built with ("BEGIN RSA PUBLIC KEY"). Null when the key or the
 * value cannot be read.
 *
 * BigInt is only ever called, never written as a literal, so an engine without it parses
 * the bundle and gets null here.
 */
export function capacitorUpdateChecksum(encrypted: string, publicKey: string | null | undefined): string | null {
  try {
    const [modulus, exponent] = rsaPublicKey(publicKey);
    const length = Math.ceil(modulus.toString(16).length / 2);
    const message = modPow(BigInt(`0x${encrypted}`), exponent, modulus)
      .toString(16)
      .padStart(length * 2, '0');

    // 00 01, at least 8 bytes of ff, 00, then the 32 bytes of the SHA-256
    return /^0001(?:ff){8,}00([0-9a-f]{64})$/.exec(message)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The modulus and exponent of a PKCS#1 PEM public key: SEQUENCE { INTEGER n, INTEGER e } */
function rsaPublicKey(pem: string | null | undefined): [bigint, bigint] {
  const der = Uint8Array.from(
    atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')),
    (char: string) => char.charCodeAt(0),
  );

  const sequence = derRead(der, 0, 0x30);
  const modulus = derRead(der, sequence.start, 0x02);
  const exponent = derRead(der, modulus.end, 0x02);

  return [derInteger(der, modulus), derInteger(der, exponent)];
}

/** The DER item of the expected tag at offset: where its content starts and ends */
function derRead(der: Uint8Array, offset: number, tag: number): { start: number; end: number } {
  if (der[offset] !== tag) {
    throw new Error('Not a PKCS#1 public key');
  }

  let length = der[offset + 1];
  let start = offset + 2;
  // A long form length: its low bits count the bytes that follow
  if (length & 0x80) {
    const bytes = length & 0x7f;
    length = der.slice(start, start + bytes).reduce((total: number, byte: number) => total * 256 + byte, 0);
    start += bytes;
  }

  return { start, end: start + length };
}

function derInteger(der: Uint8Array, item: { start: number; end: number }): bigint {
  const hex = Array.from(der.slice(item.start, item.end), (byte: number) => byte.toString(16).padStart(2, '0'))
    .join('');

  return BigInt(`0x${hex}`);
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  const zero = BigInt(0);
  const one = BigInt(1);
  let result = one;
  let factor = base % modulus;
  let remaining = exponent;

  while (remaining > zero) {
    if ((remaining & one) === one) {
      result = (result * factor) % modulus;
    }

    factor = (factor * factor) % modulus;
    remaining >>= one;
  }

  return result;
}
