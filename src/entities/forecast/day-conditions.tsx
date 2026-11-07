import type { Place } from '@/shared/api';
import { daysFromToday, getTide } from '@/shared/lib';
import { ErrorText } from '@/shared/ui';
import { FORECAST_DAYS, useForecast } from './api';

const Item = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="mono-label">{label}</dt>
    <dd className="font-semibold">{value}</dd>
  </div>
);

export const DayConditions = ({ date, place }: { date: string; place: Pick<Place, 'name' | 'latitude' | 'longitude'> }) => {
  const days = daysFromToday(date);
  const available = days >= 0 && days <= FORECAST_DAYS;
  const { data, error } = useForecast(date, place.latitude, place.longitude, available);
  const tide = getTide(date, place.latitude, place.longitude);

  return (
    <section aria-label={`${place.name} 물때와 날씨`} className="panel flex flex-col gap-3">
      <p className="mono-label">{`${place.name} 기준`}</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Item label={`물때 (${tide.system})`} value={tide.name ?? ''} />
        <Item label="음력" value={`${tide.lunarDay}일`} />
        {data && (
          <>
            <Item label="날씨" value={data.weather} />
            <Item label="기온" value={`${data.tempMin}° / ${data.tempMax}°`} />
            {data.rain !== null && <Item label="강수 확률" value={`${data.rain}%`} />}
            <Item label="최대 풍속" value={`${data.wind}m/s`} />
            {data.wave !== null && <Item label="최대 파고" value={`${data.wave}m`} />}
          </>
        )}
      </dl>
      {!available && <p className="text-sm text-muted">{`날씨 예보는 오늘부터 ${FORECAST_DAYS}일 뒤까지 볼 수 있습니다.`}</p>}
      <ErrorText error={error} />
      <p className="text-sm text-muted">물때는 음력으로 계산한 어림값입니다. 출조 전 실제 조석표를 확인해 주세요.</p>
    </section>
  );
};
