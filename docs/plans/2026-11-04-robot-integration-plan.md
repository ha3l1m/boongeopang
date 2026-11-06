# 붕붕 붕어빵 — 로봇 연동 & 마감 계획

- 마감: **2026-11-14(토) 14:00** 최종 산출물 완료 → 16:00~18:00 발표
- 산출물: GitHub 소스 / 구현 영상 / 구현 사진 (+ PPT)
- 원칙: CV 미사용, 좌표 티칭 기반. 🔴 필수 먼저, **11/12(목) 백업 영상 확보**가 사실상 진짜 마감.

## 1. 현재 상태 (11/4 기준)

| 영역 | 상태 |
|---|---|
| React 웹앱 (S1~S5, 3D 붕봇, 테스트) | ✅ MVP 완료 — 진행상태는 `statusAt()` mock 타이머(8초/단계) |
| 주문 저장 | localStorage (`orderService` 한 곳에 래핑 → 교체 지점) |
| ROS2 / 로봇 | ❌ 미착수 |
| 붕어빵 틀 모형, 그리퍼 | ❌ 미정 |

## 2. 전체 구조

> 개발 환경: 웹앱 `npm run dev -- --port 5179` → http://localhost:5179/login , rosbridge → `ws://localhost:9090`
> 같은 PC면 그대로 연결됨. 로봇 PC(RTX 노트북)와 웹 PC가 다르면 `ws://<로봇PC IP>:9090` 으로 바꾸고 `VITE_ROSBRIDGE_URL` 환경변수로 관리.

```
[React 웹앱] ──WebSocket(roslib.js)──▶ [rosbridge_server :9090]
                                            │
                    /boong/submit_order (srv)│  ▲ /boong/orders (topic, 큐 현황)
                                            ▼  │
                                   [order_manager 노드]  ← Queue(FIFO, deque)
                                            │ 한 번에 1건씩
                     /boong/make_bungeoppang (action)
                                            ▼
                                   [robot_action_server 노드]
                                     poses.yaml 읽어서 동작 시퀀스 실행
                                            │ DSR_ROBOT2 movej/movel, 그리퍼
                                            ▼
                                   [Doosan E0509 (doosan-robot2 드라이버)]
```

- 웹 → ROS 직접 action 대신 **service로 주문 제출 + topic으로 상태 구독**: 웹 코드가 단순해지고, 큐는 ROS 쪽에서 관리.
- `robot_action_server`에 **`mock:=true` 파라미터** → 로봇 없이 sleep으로 단계 진행. 웹 연동·영상 리허설을 로봇 없이도 진행 가능.

## 3. 인터페이스 정의 (패키지 `boong_interfaces`)

`action/MakeBungeoppang.action`
```
# Goal (붕어빵 주문)
string order_id
int32  order_number
string flavor        # "redbean" | "cream"
int32  qty
---
# Result (붕어빵 완성)
bool   success
string order_id
string message
---
# Feedback (단계 표시 🟢)
string step          # "pour" | "filling" | "cover" | "flip" | "done"
int32  piece_index   # 몇 번째 붕어빵
float32 progress     # 0.0~1.0
```

`srv/SubmitOrder.srv`
```
string order_id
int32  order_number
string flavor
int32  qty
---
bool   accepted
int32  queue_position
```

`/boong/orders` (std_msgs/String, JSON) — 1초 주기 또는 변경 시 발행
```json
[{"order_id":"...","number":27,"flavor":"redbean","qty":1,
  "state":"waiting|baking|done|failed","step":"pour","queue_position":0}]
```

### 3-1. 이상 알림 · 관제 인터페이스 (11/5 추가)

웹 주문판의 관제 기능(`src/services/robotService.ts`)이 지금은 데모 버튼으로 동작한다. 아래 메시지가 들어오면 데모 버튼 대신 실제 신호로 교체한다.

**감지 가능 여부 (CV 미사용 기준)**

| 이상 `kind` | 판단 근거 | 발행 노드 | 상태 |
|---|---|---|---|
| `gripper` 그리퍼가 놓침 | 그리퍼 잡음 신호 실패, 또는 드라이버의 충돌·보호정지 에러 | `robot_action_server` | ✅ 11/14 목표 |
| `burnt` 너무 탐(탈 위험) | 굽기 단계가 `BAKE_TIMEOUT_SEC` 초과 (타이머) | `order_manager` | ✅ 11/14 목표 (실제 탔는지가 아니라 "시간 초과" 경고) |
| `overpour` 반죽 과다 | 붓기 전후 틀 무게 차이 | 로드셀 노드 (미정) | ⛔ 센서 없음 — 웹에서 비활성 |
| `missing_filling` 속 누락 | 속 단계 후 무게 증가량 부족 | 로드셀 노드 (미정) | ⛔ 센서 없음 — 웹에서 비활성 |

> ⚠️ 미확인: 두산 ROS2 드라이버(doosan-robot2)가 에러·그리퍼 상태를 어떤 토픽/서비스로 주는지. 로봇 날 드라이버 문서와 `ros2 topic list`로 확인 후 이 표에 기입.

`/boong/robot_alert` (std_msgs/String, JSON) — 이상 발생 시 1회 발행 (ROS → 웹)
```json
{"order_id":"...","kind":"gripper|burnt|overpour|missing_filling",
 "source":"driver|gripper|timer|loadcell","message":"원문 에러 메시지","at":"2026-11-14T05:12:00Z"}
```
- 발행과 동시에 `robot_action_server`는 해당 주문 동작을 **일시정지**하고 대응을 기다린다.

`srv/ResolveAlert.srv` (웹 → ROS) — 주문판 대응 버튼
```
string order_id
string action      # "retry"(다시 굽기) | "continue"(그대로 진행) | "cancel"(주문 취소)
---
bool   ok
string message
```

`srv/SetEstop.srv` (웹 → ROS) — 비상 정지 / 재개
```
bool stop          # true=비상 정지, false=재개
---
bool ok
```
- 웹 비상정지는 **보조 수단**. 실제 안전은 로봇 티치펜던트·하드웨어 비상정지 버튼이 우선.

`/boong/robot_state` (std_msgs/String, JSON) — 1초 주기 (ROS → 웹)
```json
{"mode":"running|idle|paused|estop","current_order_id":"...","connected":true}
```

**웹 교체 지점**: `robotService.ts`의 `raiseAlert / resolveAlert / emergencyStop / resumeRobot`을 위 토픽·서비스 호출로 바꾸면 주문판 UI는 수정 없이 동작.

## 4. ROS2 워크스페이스 구조 (GitHub는 `web/` + `ros2_ws/` 모노레포 권장)

```
ros2_ws/src/
  boong_interfaces/      # action, srv
  boong_robot/
    boong_robot/order_manager.py
    boong_robot/robot_action_server.py
    boong_robot/motions.py        # pour(), add_filling(), cover(), flip()
    config/poses.yaml             # 🟡 좌표 파일 분리 (자리 바뀌면 숫자만 수정)
    launch/boong.launch.py        # rosbridge + manager + action server (mock 인자)
```

`poses.yaml` 예시
```yaml
speed: {vel: 30, acc: 30}        # 저속 시작 → 🟢 정상 속도
home:        {j: [0, 0, 90, 0, 90, 0]}
batter_pick: {x: [..6개..]}
mold_pour:   {x: [..]}
redbean_pick:{x: [..]}
cream_pick:  {x: [..]}
mold_handle: {x: [..]}
flip_rotate_deg: 180             # 그리퍼 x축 회전
```

## 5. 동작 시퀀스 (11/4 스케치 반영)

로봇은 **그리퍼 하나로 도구를 바꿔 잡는다**: 도구 거치대(반죽 컵 / 앙금 컵 / 틀 손잡이 / 집게)를 바닥에 고정하고 좌표를 하나씩 찍어 둔다.

| # | 단계 | 함수 | 동작 | 우선순위 | 웹 단계 |
|---|---|---|---|---|---|
| 1 | 반죽 붓기 | `pour_batter()` | 반죽 컵 집기 → 틀 위 → J6 기울여 붓기 → 컵 제자리 | 🔴 | batter |
| 2 | 앙금 넣기 | `add_filling(flavor)` | 팥/슈크림 컵 집기 → 틀 위 → 기울이기 → 제자리 | 🟡 | filling |
| (3) | 반죽 덮기 | `pour_batter()` 재사용 | 시간 남으면 | 🟢 | filling |
| 4 | 굽기 대기 | `wait_bake()` | `time.sleep(bake_sec)` (RViz/영상에선 짧게) | 🔴 | baking |
| 5 | 틀 뒤집기 | `flip_mold()` | 틀 손잡이 집기 → 힌지 축 기준 J6 180° → 놓기 → 대기 | 🔴 | baking |
| 6 | 꺼내서 봉투 | `pick_to_bag()` | (틀 열기) → 붕어빵 집기 → 봉투 위 이동 → 그리퍼 열어 떨어뜨리기 | 🟡 | packed |
| 7 | 완료 | — | home 복귀, action result | 🔴 | ready |

- 모든 동작 공통 패턴: `home → 접근점(목표 +Z 100mm) → movel 하강 → 작업 → movel 상승 → home`.
- 6번 붕어빵은 반죽이 실제로 굳지 않으므로 **미리 만든 모형 붕어빵**(점토/스펀지)을 틀에 넣어두고 집는다.
- 집게 대신 **그리퍼로 직접 집기**가 더 쉬움(집게는 그리퍼가 집게를 잡고 눌러야 해서 한 단계 더 어려움).
- 실제 붕어빵 틀은 조개처럼 여닫는 구조 → 모형 틀을 **힌지형(경첩) + 손잡이 1개**로 만들면 뒤집기·열기가 쉬움.
- 웹의 `packed`(포장 완료) 단계가 6번과 딱 맞으므로 유지.

## 6. 웹앱 변경 사항

1. **메뉴 정리**: 로봇은 단팥/슈크림만 → `choco` 숨김(또는 "준비 중" 표시). 수량 제한 `MAX_PER_FLAVOR=2`, `MAX_TOTAL=2` 정도로 축소(시연 시간).
2. **단계 맞추기**: `received(대기) → batter(1) → filling(2·3) → baking(4·5) → packed(6 봉투) → ready(7)` — 기존 BAKE_STEPS 그대로 사용 가능.
3. **어댑터 추가** `src/services/robotService.ts`
   - `VITE_ROBOT_MODE=mock|ros` — mock이면 지금의 `statusAt()` 그대로, ros면 rosbridge 사용
   - `submitOrder(order)` → `/boong/submit_order` 호출
   - `subscribeOrders(cb)` → `/boong/orders` 구독 → 주문 상태 갱신
   - 의존성: `roslib` (npm)
4. **주문 현황 표시 🟡**: 내역/진행 화면에서 `waiting / baking / done` + 대기 순번(`queue_position`) 노출.
5. 연결 끊김 시 상단 배너 "붕봇 연결 중…" (시연 중 당황 방지).

## 7. 일정 (11/4 수 → 11/14 토 14:00) — 11/4 회의 반영

> **실제 로봇 사용일 확정: 11/7(토)·11/9(월)** (11/4 팀 확인). 나머지 날은 Docker **virtual 모드(에뮬레이터)**로 개발·검증하고, 로봇 시간엔 연결·티칭·촬영만 한다.
> 로봇 환경: [`docker/README.md`](../../docker/README.md) — `./robot.sh up / check / bringup / test`

| 날짜 | 로봇/ROS | 웹 | 기타 |
|---|---|---|---|
| **11/4 (수)** | 인터페이스(3절) 합의 | 메뉴/단계 정리(6-1, 6-2) | 노션 공유(팀장), 담당 태그 |
| **11/5 (목)** | RTX 노트북 `./robot.sh up` → **virtual 모드로 test 성공** | `robotService` mock 모드 | 멘토링: 그리퍼 제어·연결 이슈 질문 |
| **11/6 (금)** | mock action server, rosbridge, `motions.py` 초안을 에뮬레이터로 | roslib 연동 → 주문 1건 왕복 | 틀 모형 소재·크기 결정, 준비물 체크 |
| **11/7 (토) 🤖** | ① `check`로 IP 확정·라벨 ② 제어 인증 + `test` ③ **붓기·뒤집기 좌표 티칭 → poses.yaml** ④ 가능하면 E2E 1건 | 현장에서 웹 → 로봇 연결 확인 | 오전 중 핵심 끝내기(팀원 1명 14시 이탈) · 틀 모형 지참 |
| **11/8 (일)** | 티칭 좌표로 에뮬레이터에서 4동작 시퀀스·Queue 완성 | 주문 현황 표시 | — |
| **11/9 (월) 🤖** | 🔴 **E2E(주문→Queue→Action→로봇) + 4동작 연속** | — | 🔴 **영상·사진 촬영(백업 확보 = 실질 마감)** |
| **11/10 (화)** | 남은 버그는 에뮬레이터에서 | feedback 단계 표시 🟢 | 멘토링 19시 전 신청, 노션 주간 업데이트 |
| **11/11~12** | 코드 정리, README 실행법 | 시연 UI 다듬기 | PPT 초안, 영상 편집 |
| **11/13 (금)** | **기능 동결** | — | GitHub 정리, PPT 완성, 리허설 |
| **11/14 (토)** | (로봇 가능 시) 최종 리허설·재촬영 | — | **14시 산출물 완료** → 16시 발표 |

### 로봇 날 체크리스트 (토·월 공통)
- [ ] RTX 노트북: 이미지 미리 빌드(`./robot.sh up`) — 현장 인터넷 느림
- [ ] 랜 케이블, 노트북 유선 고정 IP 192.168.137.50
- [ ] 틀 모형, 반죽 대용(물/모형), 마킹 테이프, 촬영용 폰 거치대
- [ ] 연결 30분 넘게 안 되면 바로 강사님 / 여분 로봇 교체 요청

## 8. 역할 분담 제안 (4인, 팀장 대영님 — 노션 태그로 확정)

- **로봇**: Docker 환경·연결·티칭·`motions.py`·poses.yaml
- **ROS**: interfaces, order_manager(Queue), action server, launch, rosbridge
- **웹**: robotService, 화면 수정, 시연 UI
- **PM/문서**: 틀 모형·준비물, 영상/사진, GitHub README, PPT, 노션

## 9. 리스크 & 대응

| 리스크 | 대응 |
|---|---|
| 로봇 사용 시간 부족 | mock 모드로 웹·ROS를 먼저 완성, 로봇 시간은 티칭/테스트에만 사용 |
| 그리퍼 제어 지연 | 11/6까지 강사님 요청. 안 되면 **도구를 툴플랜지에 고정**(국자/틀 손잡이 지그)해서 그리퍼 없이 진행 |
| 뒤집기 시 틀 충돌·이탈 | 저속, 회전 중심을 틀 손잡이 축에 맞춤, 빈 틀로 먼저 반복 테스트 |
| 반죽 흘림·청소 | 기본은 **모형/물**, 실제 반죽은 🟢 |
| 발표 당일 실기 실패 | 11/12 영상 확보, 발표에서 mock 모드 웹 시연 + 영상 재생 |
| 좌표 틀어짐(자리 이동) | 틀·재료 위치 바닥 마킹 테이프, poses.yaml만 수정 |

## 10. 완료 기준 (발표 전 체크)

- [ ] 웹에서 단팥 1개 주문 → 로봇이 붓기 → 뒤집기 완료 → 웹에 "픽업 대기" 표시
- [ ] 주문 2건 연속 넣으면 두 번째가 "대기 1번"으로 보이고 순서대로 처리
- [ ] `ros2 launch boong_robot boong.launch.py mock:=true` 로 로봇 없이 전체 흐름 재현
- [ ] README에 실행 순서(드라이버 → launch → `npm run dev`) 정리
- [ ] 영상·사진, PPT 업로드, GitHub 링크 노션 공유
