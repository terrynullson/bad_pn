import { fetchCallfilter } from './callfilter';
import { fetchKtoZvonil } from './ktozvonil';
import { fetchSpravPortal } from './spravportal';
import { delay } from './rate-limit';
import { fetchYandexCaller } from './yandex-caller';
import type {
  CallfilterCheck,
  KtoZvonilResponse,
  SpravPortalCheck,
  YandexCallerCheck,
} from './types';

export interface PhoneSourceData {
  ktozvonil: KtoZvonilResponse | null;
  ktozvonilUnavailable: boolean;
  spravportal: SpravPortalCheck | null;
  callfilter: CallfilterCheck | null;
  yandexCaller: YandexCallerCheck | null;
}

export async function checkPhoneSources(
  phone: string
): Promise<PhoneSourceData> {
  const ktozvonil = await fetchKtoZvonil(phone);
  await delay(400);

  const spravportal = await fetchSpravPortal(phone);
  await delay(400);

  const callfilter = await fetchCallfilter(phone);
  await delay(400);

  const yandexCaller = await fetchYandexCaller(phone);

  return {
    ktozvonil,
    ktozvonilUnavailable: ktozvonil === null,
    spravportal,
    callfilter,
    yandexCaller,
  };
}
