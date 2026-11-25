/**
 * Identity check seam. A later provider (Onfido, Veriff, Freja, ZignSec)
 * can replace `kycAdapter` without changing the screens.
 * The placeholder never sends images. Callers only pass that a photo was taken.
 */

export type KycDocument = "passport" | "national-id" | "driving-licence";

export type KycCapture = {
  document: KycDocument;
  front: boolean;
  back: boolean;
  selfie: boolean;
};

export type KycResult = {
  status: "pending";
  provider: "placeholder";
  reference: string;
};

export type KycAdapter = {
  id: KycResult["provider"];
  /** Must not upload image bytes. A real adapter would open the provider SDK instead. */
  submit(capture: KycCapture): Promise<KycResult>;
};

export function needsBack(document: KycDocument) {
  return document === "national-id" || document === "driving-licence";
}

export const documentLabel: Record<KycDocument, string> = {
  passport: "Pass",
  "national-id": "Nationellt id-kort",
  "driving-licence": "Svenskt körkort",
};

export const kycAdapter: KycAdapter = {
  id: "placeholder",
  async submit(capture) {
    if (!capture.front || !capture.selfie) {
      throw new Error("Framsida och selfie behövs. Ingenting har skickats.");
    }
    if (needsBack(capture.document) && !capture.back) {
      throw new Error("Baksidan behövs. Ingenting har skickats.");
    }
    return {
      status: "pending",
      provider: "placeholder",
      reference: `placeholder-${Date.now()}`,
    };
  },
};
