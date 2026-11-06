# 고객 피드백 → 로봇 보정 (2026-11-06)

## 목표
직원이 **픽업 완료**를 누르면 고객 앱 주문 상태 화면에 피드백 bottom sheet가 뜬다.
여러 고객 피드백의 **가중 중앙값**으로 로봇 보정값을 추천하고, **사장님 승인 후** 적용한다.

## 결정 사항
| 항목 | 결정 |
|---|---|
| 척도 | 양극 5단계 `-2 ~ +2`, 0 = 딱 좋아요 |
| 항목 | 굽기 정도(덜 익음↔탔어요) · 앙금 양(적음↔많음, **맛별**) · 바삭함(눅눅↔너무 딱딱). "탄 정도"는 굽기 +2로 통합 |
| 집계 | 가중 중앙값 (평균 아님 → 극단값 한두 개에 안 흔들림) |
| 가중치 | 최신성 `0.5^(경과일/3)` × 단골 `1 + 0.25·min(누적주문-1, 4)` (최대 2배) |
| 적용 | 사장님 승인. 최소 표본 5건, 1회 변경 = 1스텝, 범위 clamp |
| 리셋 | 항목별 마지막 적용 이후 피드백만 집계 (이전 값 기준 피드백 제외) |

## 로봇 파라미터 (기본값은 placeholder — 실제 로봇 측정 후 수정)
| 파라미터 | 피드백 | 기본 | 1스텝 | 범위 |
|---|---|---|---|---|
| `bakeSec` 굽기 시간 | 굽기 정도 | 90s | ±5s | 60~150 |
| `crispSec` 뒤집은 후 마무리 | 바삭함 | 20s | ±3s | 5~45 |
| `fillingGrams[flavor]` 앙금 양 | 앙금 양 | 25g | ±2g | 15~40 |

추천 방향: 중앙값이 `+`(너무 많이/많이 구움)면 줄이고 `-`면 늘림. `|중앙값| < 0.5`면 "유지".

## 파일
신규
- `src/domain/feedback.ts` (+test): 타입, `weightedMedian`, `feedbackWeight`, `recommend()`
- `src/domain/tuning.ts`: 파라미터 정의·기본값·스텝·범위
- `src/services/feedbackService.ts` (+test): `boong:feedback` 저장/조회, 중복 방지, 건너뛰기 기록
- `src/services/tuningService.ts` (+test): `boong:tuning` 현재값 + 적용 이력
- `src/components/FeedbackSheet.tsx`: bottom sheet (3행 × 5칩, 보내기/나중에)
- `src/pages/admin/TuningCard.tsx`: 오늘 현황 > 추천 보정 카드 (현재값 → 추천값, 표본 수, 적용/무시)

수정
- `src/pages/OrderStatusPage.tsx`: `picked_up` && 미응답 && 미건너뜀 → sheet 표시
- `src/pages/admin/AdminOrdersPage.tsx`: 오늘 현황에 TuningCard 추가
- CSS: `components.css`, `admin.css`
- `src/App.test.tsx`: 통합 테스트

기존 `RobotState`/`Order` 스키마는 **안 바꿈** (별도 키에 저장).

## 테스트 (TDD)
- weightedMedian: 홀/짝, 가중치 편중, 빈 배열
- 가중치: 3일 지나면 절반, 단골 상한 2배
- recommend: 표본 < 5 → 없음, 1스텝 제한, 범위 clamp, 마지막 적용 이후만 집계
- UI: 픽업 완료 → sheet 노출 → 보내면 저장되고 다시 안 뜸 / 나중에 → 안 뜸
- 어드민: 피드백 5건 → 추천 카드 → 적용 → 값 변경 + 이력

## 비목표
- 실제 로봇 파라미터 전송 (rosbridge 연동 시 `tuningService` 한 곳만 교체)
- 기기 간 동기화 (현재 localStorage 구조 한계 그대로)
- 자유 텍스트 리뷰, 사진

## 위험
- 기본값/스텝은 추정치 → 실제 로봇에서 보정 필요
- 같은 브라우저에서만 고객↔어드민 연결 (기존 한계)
- 롤백: 신규 파일 삭제 + 수정 3곳 되돌리기. 저장 키가 분리돼 기존 데이터 영향 없음
