import { useEffect, useRef, useState } from 'react';
import { currentSubscription, disablePush, enablePush, pushSupported } from './push';

/** 이 기기에서 출조 알림을 켜고 끕니다. 켜면 테스트 알림이 바로 옵니다. */
export const PushToggle = () => {
  const [on, setOn] = useState<boolean>();
  // 설정에 들어올 때 구독 여부를 받아 켜짐으로 바뀌는 순간에는 손잡이가 미끄러지지 않게, 사용자가 누른 뒤에만 움직입니다.
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    let alive = true;
    void currentSubscription()
      .then((subscription) => alive && setOn(Boolean(subscription)))
      .catch(() => alive && setOn(false));
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async () => {
    if (lock.current) return;
    if (!pushSupported()) {
      setMessage('이 브라우저는 알림을 받을 수 없습니다. 아이폰은 홈 화면에 추가한 앱에서 켤 수 있습니다.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (on) {
        await disablePush();
        setOn(false);
        setMessage('이 기기의 알림을 껐습니다.');
      } else {
        const { tested } = await enablePush();
        setOn(true);
        setMessage(tested ? '알림을 켰습니다. 출조 전날 오후 6시에 알려 드립니다.' : '알림을 켰지만 테스트 알림을 보내지 못했습니다. 끄고 다시 켜면 다시 보내 봅니다.');
      }
    } catch (error) {
      // 실패 뒤에는 브라우저의 실제 구독 여부로 화면을 맞춥니다.
      setOn(Boolean(await currentSubscription().catch(() => null)));
      // 권한·서버 안내는 그대로, 브라우저 오류(구독 실패 등)는 알기 쉬운 말로 바꿉니다.
      setMessage(error instanceof Error && /[가-힣]/.test(error.message) ? error.message : '알림을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 화면 테마의 '다크 모드'처럼 켜고 끄는 스위치입니다(사용자 요청). 켜짐은 aria-checked와 손잡이 위치로 알립니다. */}
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(on)}
        aria-describedby="push-help"
        className="switch self-start"
        disabled={busy || on === undefined}
        data-still={touched ? undefined : ''}
        onClick={() => {
          setTouched(true);
          void toggle();
        }}
      >
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        이 기기에서 알림 받기
      </button>
      <p id="push-help" className="text-sm text-muted">내일 일정이 있으면 전날 오후 6시, 평점 대기가 있으면 토요일 오후 6시에 알려 드립니다.</p>
      <p role="status" className="text-sm text-muted empty:hidden">{message}</p>
    </div>
  );
};
