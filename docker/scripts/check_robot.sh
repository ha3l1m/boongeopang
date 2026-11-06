#!/usr/bin/env bash
# 로봇 컨트롤러 연결 점검: 내 IP 대역 → ping → 12345 포트 → 실패 시 주변 IP 스캔
HOST="${1:-${ROBOT_HOST:-192.168.137.100}}"
PORT="${ROBOT_PORT:-12345}"
echo "== 1. 이 노트북의 192.168.137.x 주소"
ip -4 addr | grep -E "inet 192\.168\.137\." || echo "  ✗ 없음 → 유선 랜에 고정 IP(예: 192.168.137.50/24)를 잡아주세요"
echo "== 2. ping $HOST"
ping -c 2 -W 1 "$HOST" >/dev/null && echo "  ✓ 응답" || echo "  ✗ 응답 없음"
echo "== 3. 포트 $HOST:$PORT"
if nc -z -w 2 "$HOST" "$PORT"; then echo "  ✓ 열림 → .env ROBOT_HOST=$HOST 로 bringup 하면 됩니다"; exit 0; fi
echo "  ✗ 닫힘 → 192.168.137.1~254 에서 $PORT 포트를 찾는 중..."
FOUND=""
for i in $(seq 1 254); do
  ( nc -z -w 1 "192.168.137.$i" "$PORT" 2>/dev/null && echo "  ✓ 후보: 192.168.137.$i" ) &
done | tee /tmp/found.txt; wait
[ -s /tmp/found.txt ] || echo "  ✗ 못 찾음 → 케이블/스위치, 컨트롤러 전원, 티치펜던트의 네트워크 설정 확인"
