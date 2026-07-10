import { fetchCallfilter } from './callfilter';
import { fetchDeepSeekCheck } from './deepseek-check';
import { fetchKtoZvonil } from './ktozvonil';
import { fetchSpravPortal } from './spravportal';
import { delay } from './rate-limit';
import { fetchYandexCaller } from './yandex-caller';
import type {
  CallfilterCheck,
  DeepSeekCheck,
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
  deepseek: DeepSeekCheck | null;
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

  const partialData: PhoneSourceData = {
    ktozvonil,
    ktozvonilUnavailable: ktozvonil === null,
    spravportal,
    callfilter,
    yandexCaller,
    deepseek: null,
  };

  await delay(300);
  const deepseek = await fetchDeepSeekCheck(phone, partialData);

  return {
    ...partialData,
    deepseek,
  };
}
