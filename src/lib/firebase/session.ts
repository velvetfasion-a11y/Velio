/** Tiny flag so the UI can skip local demo seeds while Firestore is the source of truth. */

let active = false;
let customerMode = false;

export function isCloudActive() {
  return active;
}

export function setCloudActive(value: boolean) {
  active = value;
}

/** The person chose the customer home even if a business profile exists. */
export function prefersCustomer() {
  return customerMode;
}

export function setPreferCustomer(value: boolean) {
  customerMode = value;
}
