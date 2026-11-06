# 붕붕 주문판 — 붕봇 관제 패널 계획

## 결정 사항 (2026-11-05)
- 범위: 로봇 상태 패널 / 이상 알림 + 대응 버튼 / 비상 정지·재개 / 재료 잔량
- 화면 색은 현행 유지
- 로봇(ROS) 미연동 → `robotService` 한 곳에 mock. 나중에 rosbridge topic·service로 교체

## 개념
- **붕봇은 한 대** → 진행 중 주문 중 가장 오래된 것 = "지금 굽는 주문", 나머지 = 대기열
- **정지 구간(pauses)**: 비상정지·이상 알림 동안 타이머가 멈춤.
  `statusAt` 경과시간 = (now − 시작) − 정지 구간과 겹친 시간. 순수 함수라 테스트 쉬움
- 관리자가 수동으로 바꾼 주문(`manualStatus`)은 기존대로 타이머 영향 없음

## 데이터 (localStorage `boong:robot`, 하위호환)
```ts
type RobotAlertKind = 'overpour' | 'missing_filling' | 'burnt' | 'gripper'
type RobotState = {
  estop: boolean
  alert?: { kind: RobotAlertKind; orderId: string; at: string }
  pauses: { from: string; to?: string }[]   // 열린 구간 = 지금 멈춤
  refilledAt: Record<Ingredient, string>     // 마지막 채운 시각
}
type Order = { ...기존, timerStart?: string } // 다시 굽기 시 타이머 재시작점
```
- 재료: 반죽(100마리분), 팥·슈크림·초코(각 40마리분)
- 잔량 = 용량 − (채운 뒤 들어온, 취소 아닌 주문 수량). 저장값 감소 없이 계산으로 구함

## 관제 패널 (주문판 맨 위)
| 영역 | 내용 |
|---|---|
| 상태 배지 | 작업 중 / 대기 / 이상 발생 / 비상 정지 + 지금 굽는 No. + 대기 N건 |
| 비상 정지 | 큰 빨간 버튼 → 확인 후 정지. 정지 중엔 "재개" 버튼 |
| 이상 알림 | 빨간 배너 "No.004 반죽이 너무 많이 부어졌어요" + [다시 굽기] [그대로 진행] [주문 취소] |
| 데모 트리거 | "이상 발생 시키기(데모)" 선택 → 지금 굽는 주문에 알림 생성 |
| 재료 잔량 | 4개 막대. 20% 이하 주황, 0이면 "품절" + [채우기] 버튼 |

알림 문구: 반죽 과다 / 속 누락 / 너무 탐 / 그리퍼 오류

## 대응 버튼 동작
- 다시 굽기: 해당 주문 `timerStart = now`(반죽 단계부터), 알림 해제, 재개
- 그대로 진행: 알림 해제, 재개
- 주문 취소: `manualStatus = cancelled`, 알림 해제, 재개

## 손님 화면 영향
- 주문 상태: 멈춤 중이면 "붕봇이 잠깐 점검 중이에요" + 남은 시간 멈춤
- 메뉴: 재료 0인 맛은 "품절" 표시 + 담기 막음. `createOrder`도 재고 부족이면 에러

## 파일
| 파일 | 변경 |
|---|---|
| `src/domain/robot.ts` (신규) + test | 타입, 정지 겹침 계산, 잔량 계산, 알림 문구 |
| `src/domain/order.ts` | `statusAt`/`secondsLeft`/`effectiveStatus`에 pauses 인자 (기본 `[]`) |
| `src/services/robotService.ts` (신규) + test | 상태 읽기/쓰기, estop/resume, raiseAlert, resolveAlert, refill |
| `src/services/orderService.ts` | 재고 확인, `restartOrder` |
| `src/pages/admin/RobotPanel.tsx` (신규) | 상태·비상정지·알림·데모 트리거 |
| `src/pages/admin/StockBars.tsx` (신규) | 재료 잔량 |
| `src/pages/admin/AdminOrdersPage.tsx`, `admin.css` | 패널 배치 |
| `OrderStatusPage`, `HistoryPage`, `MenuPage` | 정지·품절 반영 |

## 테스트
- 정지 겹침: 구간 없음 / 주문 전 정지 / 진행 중 열린 정지 / 여러 구간
- 잔량: 채운 뒤 주문만, 취소 제외, 0 미만 안 됨
- robotService: estop → resume이 구간 닫음, 알림 해제 3종 동작
- createOrder 품절 에러
- Browser: 데스크톱·모바일 + 비상정지 시 손님 화면 멈춤 확인

## 비목표
- 실제 센서/ROS 연동, 알림 소리·푸시, 이력 로그 저장
