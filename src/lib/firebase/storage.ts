/**
 * Image storage adapter.
 * Cloud Storage is not enabled on the Spark plan (it needs Blaze).
 * The UI keeps a local preview. When Storage is turned on, implement storeImage
 * with firebase/storage and return an https URL that fits photoURL in the rules.
 */

export const remoteImagesEnabled = false;

export async function storeImage(_file: Blob, _path: string): Promise<string | null> {
  return null;
}
