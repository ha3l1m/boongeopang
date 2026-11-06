#!/usr/bin/env bash
# 두산 드라이버 + RViz 실행. virtual이면 에뮬레이터가 호스트 docker에 자동으로 뜸
set -e
MODE="${ROBOT_MODE:-virtual}"
HOST="${ROBOT_HOST:-127.0.0.1}"
[ "$MODE" = "virtual" ] && HOST=127.0.0.1
echo "▶ mode=$MODE host=$HOST port=${ROBOT_PORT:-12345} model=${ROBOT_MODEL:-e0509}"
exec ros2 launch dsr_bringup2 dsr_bringup2_rviz.launch.py \
  mode:="$MODE" host:="$HOST" port:="${ROBOT_PORT:-12345}" model:="${ROBOT_MODEL:-e0509}" name:="${ROBOT_ID:-dsr01}"
