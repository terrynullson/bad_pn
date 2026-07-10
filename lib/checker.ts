import { fetchKtoZvonil } from './ktozvonil';
import { fetchSpravPortal } from './spravportal';
import { delay } from './rate-limit';
import type { KtoZvonilResponse, SpravPortalCheck } from './types';

export interface PhoneSourceData {
  ktozvonil: KtoZvonilResponse | null;
  ktozvonilUnavailable: boolean;
  spravportal: SpravPortalCheck | null;
}

export async function checkPhoneSources(
  phone: string
): Promise<PhoneSourceData> {
  const ktozvonil = await fetchKtoZvonil(phone);
  await delay(400);

  const spravportal = await fetchSpravPortal(phone);

  return {
    ktozvonil,
    ktozvonilUnavailable: ktozvonil === null,
    spravportal,
  };
}
