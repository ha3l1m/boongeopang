#!/usr/bin/env bash
# 로봇 컨트롤러 연결 점검: 내 IP 대역 → ping → 12345 포트 → 실패 시 주변 IP 스캔
SUBNET="${ROBOT_SUBNET:-110.120.1}"
HOST="${1:-${ROBOT_HOST:-$SUBNET.64}}"
PORT="${ROBOT_PORT:-12345}"
HAS_ADDR=""
echo "== 1. 이 노트북의 $SUBNET.x 주소"
if ip -4 addr | grep -F "inet $SUBNET."; then
  HAS_ADDR=1
else
  echo "  ✗ 없음 → 유선 랜에 고정 IP($SUBNET.<다른 조와 겹치지 않는 번호>/24, 게이트웨이 $SUBNET.1)를 잡아주세요"
fi
# 로봇 대역은 사설 주소가 아니다. 유선 없이 보내면 인터넷의 남의 주소로 나간다.
if [ -z "$HAS_ADDR" ] && [[ "$HOST" == "$SUBNET".* ]]; then
  echo "  → 유선 주소가 없어 ping·포트 점검과 스캔을 건너뜁니다"
  exit 1
fi
echo "== 2. ping $HOST"
ping -c 2 -W 1 "$HOST" >/dev/null && echo "  ✓ 응답" || echo "  ✗ 응답 없음"
echo "== 3. 포트 $HOST:$PORT"
if nc -z -w 2 "$HOST" "$PORT"; then echo "  ✓ 열림 → .env ROBOT_HOST=$HOST 로 bringup 하면 됩니다"; exit 0; fi
[ -n "$HAS_ADDR" ] || exit 1
echo "  ✗ 닫힘 → $SUBNET.1~254 에서 $PORT 포트를 찾는 중..."
FOUND=""
for i in $(seq 1 254); do
  ( nc -z -w 1 "$SUBNET.$i" "$PORT" 2>/dev/null && echo "  ✓ 후보: $SUBNET.$i" ) &
done | tee /tmp/found.txt; wait
[ -s /tmp/found.txt ] || echo "  ✗ 못 찾음 → 케이블/스위치, 컨트롤러 전원, 티치펜던트의 네트워크 설정 확인"
