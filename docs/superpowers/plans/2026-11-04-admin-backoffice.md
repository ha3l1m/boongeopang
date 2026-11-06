# 붕붕 붕어빵 — 주문 백오피스(관리자) 계획

## 결정 사항 (2026-11-04)
- 위치: 같은 앱 `/admin` 라우트 (손님 앱과 localStorage 공유)
- 기능: 주문 목록·상세 / 상태 수동 변경 / 주문 취소 / 오늘 매출·맛별 수량 집계
- 인증: 임시 PIN (`VITE_ADMIN_PIN`, 미설정 시 진입 불가 안내). 데모용, 실보안 아님

## 데이터 모델 변경 (하위호환)
```ts
type AdminStatus = OrderStatus | 'picked_up' | 'cancelled'
type Order = { ...기존, manualStatus?: AdminStatus }
effectiveStatus(order, now) = order.manualStatus ?? statusAt(order.createdAt, now)
```
- `manualStatus` 없으면 기존처럼 8초 타이머 자동 진행 → 기존 저장 주문 그대로 동작
- 관리자가 한 번이라도 조작하면 그 주문은 타이머 멈추고 관리자 값 사용
- 나중에 ROS 연동 시 `/boong/orders` topic 값이 이 자리 대체

## 파일
| 파일 | 변경 |
|---|---|
| `src/domain/order.ts` | `AdminStatus`, `manualStatus`, `effectiveStatus`, `nextStatus` |
| `src/services/orderService.ts` | `listAllOrders`, `setOrderStatus(id, status)` |
| `src/services/adminAuth.ts` (신규) | PIN 확인, sessionStorage 로그인 |
| `src/pages/admin/AdminLoginPage.tsx` (신규) | PIN 입력 |
| `src/pages/admin/AdminOrdersPage.tsx` (신규) | 요약카드 + 필터(진행중/픽업대기/완료/취소) + 주문 목록·상세 + 다음 단계/픽업완료/취소 버튼 |
| `src/pages/admin/admin.css` (신규) | 기존 tokens.css 토큰 재사용, 데스크톱 폭 레이아웃 |
| `src/App.tsx` | `/admin/login`, `/admin` 라우트 (탭바 없음) |
| `HistoryPage`, `OrderStatusPage`, `StatusChip` | `statusAt` → `effectiveStatus`, 픽업완료·취소 표시 |

## 동작
- 다른 탭에서 손님 주문 → `storage` 이벤트 + 1초 tick으로 관리자 화면 자동 갱신
- 취소/픽업완료는 확인 다이얼로그 후 처리
- 집계: 오늘(로컬 날짜) 주문, 취소 제외 매출, 맛별 수량

## 테스트 (TDD)
- domain: `effectiveStatus`, `nextStatus`(ready→picked_up, 종료상태는 그대로)
- service: `setOrderStatus` 저장/없는 id 에러, `listAllOrders` 정렬, 오늘 집계
- adminAuth: 틀린 PIN 거부, 맞는 PIN 통과
- UI: Browser로 데스크톱/모바일 확인 + 스크린샷

## 비목표
- 실제 서버/DB, 다중 관리자, 메뉴 편집, 환불
