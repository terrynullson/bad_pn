import { fetchCallfilter } from './callfilter';
import { fetchDeepSeekCheck } from './deepseek-check';
import { fetchKtoZvonil } from './ktozvonil';
import { fetchSpravPortal } from './spravportal';
import type { PhoneSearchCache } from './search-fallback';
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
  ktozvonilFailureReason: string | null;
  spravportal: SpravPortalCheck | null;
  callfilter: CallfilterCheck | null;
  yandexCaller: YandexCallerCheck | null;
  deepseek: DeepSeekCheck | null;
}

export async function checkPhoneSources(
  phone: string,
  searchCache?: PhoneSearchCache
): Promise<PhoneSourceData> {
  const [ktoResult, callfilter] = await Promise.all([
    fetchKtoZvonil(phone),
    fetchCallfilter(phone),
  ]);

  const spravportal = await fetchSpravPortal(phone, searchCache);
  const yandexCaller = await fetchYandexCaller(phone, searchCache);

  const partialData: PhoneSourceData = {
    ktozvonil: ktoResult.data,
    ktozvonilUnavailable: ktoResult.data === null,
    ktozvonilFailureReason: ktoResult.failureReason,
    spravportal,
    callfilter,
    yandexCaller,
    deepseek: null,
  };

  const deepseek = await fetchDeepSeekCheck(phone, partialData, searchCache);

  return {
    ...partialData,
    deepseek,
  };
}
