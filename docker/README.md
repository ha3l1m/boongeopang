# 붕봇 로봇 제어 환경 (Docker · RTX 노트북 ↔ Doosan E0509)

RTX 노트북에서 Docker 컨테이너 하나로 **두산 ROS2 드라이버(Humble) + RViz + rosbridge**를 띄웁니다.
노트북 OS가 Ubuntu 22.04가 아니어도 동일 환경, 팀원 누구 노트북이든 같은 명령으로 재현됩니다.

```
[RTX 노트북 (Linux)]
 └─ docker: boong_dsr  (network_mode: host)
      ├─ dsr_bringup2 ──TCP 12345──▶ [E0509 컨트롤러 192.168.137.x]   (real)
      │               └────────────▶ [dsr_emulator 컨테이너 127.0.0.1] (virtual)
      ├─ boong 노드들 (ros2_ws/src 마운트)
      └─ rosbridge :9090 ◀── WebSocket ── [React 웹앱 localhost:5179]
```

## 0. 준비 (노트북에 1회)

1. Docker 설치 + sudo 없이 실행: `sudo usermod -aG docker $USER` 후 재로그인
2. 이 저장소 clone → `cd boong/docker`
3. `cp .env.example .env` (또는 `./robot.sh` 실행하면 자동 생성)
4. (선택) RViz가 느리면 `nvidia-container-toolkit` 설치 후 `compose.yaml`의 `deploy:` 주석 해제

## 1. 로봇 없이 먼저 (virtual 모드) — 목·금 집에서

```bash
./robot.sh up          # 첫 빌드 10~20분
./robot.sh bringup     # 터미널 1: 에뮬레이터 + RViz에 E0509 표시
./robot.sh test        # 터미널 2: J6가 ±10° 움직이면 성공
```
> 에뮬레이터 이미지(`doosanrobot/dsr_emulator`)는 첫 실행 때 받아옵니다.
> 컨테이너 안에서 에뮬레이터가 안 뜨면 호스트에서 `docker images | grep dsr_emulator` 확인 후 두산 저장소의 `install_emulator.sh`를 호스트에서 한 번 실행.

## 2. 실제 로봇 (real 모드) — 토·월 현장

1. 노트북 유선 랜 ↔ 컨트롤러 케이블 연결, 노트북 유선 IP를 **고정**: `192.168.137.50 / 255.255.255.0` (로봇과 겹치지 않는 번호)
2. 티치펜던트: 로봇 서보 ON, **원격/자동 제어 허용**(제어 인증), 속도 저속
3. 컨트롤러 IP 찾기
   ```bash
   ./robot.sh check                  # .env의 ROBOT_HOST 점검, 실패 시 대역 전체 스캔
   ./robot.sh check 192.168.137.64   # 특정 IP 점검
   ```
   - 라벨 IP와 실제가 다를 수 있음(지난번 65 ↔ 64). **스캔에서 나온 IP를 기준으로.**
   - 찾은 IP를 로봇 몸체에 테이프로 붙여 두기 (안 되는 로봇도 표시)
4. `.env` 수정: `ROBOT_MODE=real`, `ROBOT_HOST=<찾은 IP>` → `./robot.sh down && ./robot.sh up`
5. `./robot.sh bringup` → RViz 자세가 실제 로봇과 같은지 확인
6. 비상정지 버튼 쥔 상태로 `./robot.sh test`

## 3. 웹앱 연동

```bash
./robot.sh bridge      # ws://<노트북IP>:9090
```
웹앱 `.env.local`: `VITE_ROBOT_MODE=ros`, `VITE_ROSBRIDGE_URL=ws://<노트북IP>:9090` (같은 노트북이면 `ws://localhost:9090`)

## 4. 안 될 때

| 증상 | 확인 |
|---|---|
| `check`에서 192.168.137.x 주소 없음 | 노트북 유선 IP 고정 안 됨 / 와이파이로만 연결 |
| ping은 되는데 12345 닫힘 | 티치펜던트 원격 제어 허용, 컨트롤러 재부팅 |
| bringup 연결 직후 끊김 | `DRCF_VER` 불일치 → 펜던트에서 컨트롤러 버전 확인, `.env` 수정 후 `./robot.sh build` |
| RViz 창 안 뜸 | 호스트에서 `xhost +local:docker`, `echo $DISPLAY` |
| 다른 팀 ROS 메시지가 섞임 | `.env`의 `ROS_DOMAIN_ID`를 팀 고유 번호로 |
| 로봇 자체 불량 의심 | 지난번처럼 여분 로봇으로 교체 요청 (다른 팀이 해결하면 방법 공유) |

## Mac에서?
Docker Desktop(Mac)은 host 네트워크·X11이 제한되고 에뮬레이터가 amd64라 느립니다. **로봇 제어는 RTX 노트북(Linux)에서**, Mac은 웹앱 개발(`VITE_ROBOT_MODE=mock`)에 쓰는 걸 권장.

참고: [Doosan ROS2 Manual — Humble 설치](https://doosanrobotics.github.io/doosan-robotics-ros-manual/humble/installation.html), [doosan-robot2 (humble)](https://github.com/doosan-robotics/doosan-robot2)

## 5. 붕봇 동작을 RViz로 보기 (에뮬레이터)

```bash
./robot.sh up && ./robot.sh ws         # 우리 패키지 빌드 (코드 바꿀 때마다 ws)
./robot.sh bringup                     # 터미널 1: 에뮬레이터 + RViz
./robot.sh boong                       # 터미널 2: 붕봇 노드 + 주문 큐 + rosbridge
./robot.sh order redbean 1 27          # 터미널 3: 주문 → RViz에서 팔이 5동작 수행
./robot.sh orders                      #          주문 현황(JSON) 확인
```

**RViz 설정 (처음 1회)**: 왼쪽 아래 `Add` → `By topic` → `/boong/scene` (MarkerArray) 추가 → 틀·컵·봉투·붕어빵이 보임.
Fixed Frame과 `poses.yaml`의 `scene_frame`이 같아야 함 (기본 `base_link`, 안 보이면 RViz Fixed Frame 이름으로 변경).
`File → Save Config` 로 저장해 두면 다음부턴 자동.

동작 하나씩 확인 (토요일 좌표 찍을 때):
```bash
./robot.sh step home
./robot.sh step pour_batter
./robot.sh step add_filling cream
./robot.sh step flip_mold
./robot.sh step pick_to_bag
```
좌표 수정 → `ros2_ws/src/boong_robot/config/poses.yaml` → `./robot.sh ws` → 다시 step.

| 코드 | 역할 |
|---|---|
| `boong_interfaces/` | action `MakeBungeoppang` (주문=goal, 완성=result, 단계=feedback), srv `SubmitOrder` |
| `boong_robot/motions.py` | 5동작 시퀀스 (ROS 의존 없음 → `pytest test/`로 로봇 없이 테스트) |
| `boong_robot/backends.py` | `DsrBackend`(두산 movej/movel) / `MockBackend` |
| `boong_robot/gripper.py` | 그리퍼 여닫기 — 강사님 방식으로 이 파일만 교체 |
| `boong_robot/scene.py` | RViz 마커 `/boong/scene` |
| `boong_robot/robot_action_server.py` | `/boong/make_bungeoppang` action 서버 |
| `boong_robot/order_manager.py` | FIFO Queue, `/boong/submit_order`, `/boong/orders` |
| `config/poses.yaml` | 모든 좌표·속도·대기시간 |
