/**
 * Reads HTTP response bytes up to a strict byte cap.
 * Throws with code 'RESPONSE_TOO_LARGE' if the response exceeds maxBytes.
 * 
 * @param {Response} response
 * @param {number} maxBytes
 * @returns {Promise<Uint8Array>}
 */
export async function readResponseBytesCapped(response, maxBytes) {
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    const error = new Error(`Response body exceeds maximum allowed cap of ${maxBytes} bytes`);
    error.code = 'RESPONSE_TOO_LARGE';
    throw error;
  }
  return new Uint8Array(buffer);
}

