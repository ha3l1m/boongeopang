#!/usr/bin/env bash
# 붕붕 로봇 Docker 헬퍼 — RTX 노트북에서 docker/ 폴더 기준으로 실행
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { cp .env.example .env; echo "· .env 생성됨 — ROBOT_MODE/ROBOT_HOST 확인하세요"; }
set -a; . ./.env; set +a
EXEC="docker exec -it boong_dsr bash -ic"

case "${1:-help}" in
  build)   docker compose build ;;
  up)      xhost +local:docker >/dev/null 2>&1 || true; docker compose up -d --build ;;
  up-mock) docker compose -f compose.mock.yaml up -d --build ;;
  down)    docker compose down ;;
  shell)   docker exec -it boong_dsr bash ;;
  check)   $EXEC "/root/scripts/check_robot.sh ${2:-}" ;;
  bringup) $EXEC "/root/scripts/bringup.sh" ;;
  test)    $EXEC "python3 /root/scripts/test_move.py" ;;
  ws)      $EXEC "cd /root/boong_ws && colcon build --symlink-install" ;;
  bridge)  $EXEC "ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090" ;;
  boong)   $EXEC "ros2 launch boong_robot boong.launch.py backend:=${2:-dsr}" ;;
  step)    $EXEC "ros2 run boong_robot run_sequence --ros-args -p step:=${2:-all} -p flavor:=${3:-redbean} -p backend:=dsr" ;;
  order)   $EXEC "ros2 service call /boong/submit_order boong_interfaces/srv/SubmitOrder \"{order_id: '', order_number: ${4:-1}, flavor: '${2:-redbean}', qty: ${3:-1}}\"" ;;
  orders)  $EXEC "ros2 topic echo /boong/orders" ;;
  *) cat <<USAGE
사용법: ./robot.sh <명령>
  up       이미지 빌드 + 컨테이너 시작 (처음엔 10~20분)
  up-mock  로봇 없는 mock 전용 이미지로 시작 (Mac 가능, 다음 순서: ws → boong mock)
  check    로봇 컨트롤러 네트워크 점검 (./robot.sh check 110.120.1.64 처럼 IP 지정 가능)
  bringup  두산 드라이버 + RViz 실행 (.env의 ROBOT_MODE 사용)  ← 터미널 1
  test     저속 동작 테스트 (J6 ±10°)                          ← 터미널 2
  bridge   rosbridge 실행 (웹앱 연동, ws://<노트북IP>:9090)
  ws       우리 패키지(ros2_ws/src) 빌드 — 코드 바꾸면 다시
  boong    붕봇 노드(action 서버+주문 큐+rosbridge) 실행  ← 터미널 2  (./robot.sh boong mock = 로봇 없이)
  step     동작 하나만: ./robot.sh step pour_batter | add_filling cream | cover_filling | wait_bake | flip_mold | pick_to_bag | home | all
  order    주문 넣기:  ./robot.sh order redbean 1 27   (맛 수량 번호표)
  orders   주문 현황 보기
  shell    컨테이너 접속
  down     종료
USAGE
  ;;
esac
