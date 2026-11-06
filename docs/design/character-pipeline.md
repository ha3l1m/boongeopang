# 할매 캐릭터 v3 — 디자인 & 제작 파이프라인 (제안)

## 캐릭터 스펙 (스케치 + 레퍼런스 종합)

| 부위 | 디자인 | 참고 |
|---|---|---|
| 모자 | 갈색 펠트/코듀로이 군밤장수 모자, 크림색 털 안감, 귀덮개(위로 접힘/아래로 내림 둘 다), 꼭대기 방울 | 스케치, 모자 일러스트 |
| 머리카락 | 모자 아래 양옆·뒤로 삐져나온 흰 뽀글 파마 | 스케치 |
| 얼굴 | 크고 둥근 얼굴(아래가 살짝 넓음), 점 눈, 짧은 눈썹 선, 동그란 코, 볼터치, 작은 미소 | 스케치, 클레이 인물 레퍼런스 |
| 안경 | 가는 검정 동그란 안경, 코에 걸침 | 할머니 피규어 |
| 몸 | 2~2.5등신 꼬마 비율, 누빔 조끼 + 보라 카디건 + 크림 앞치마, 벙어리장갑 손, 뭉툭한 발 | 할머니 피규어, 클레이 인물 레퍼런스 |
| 재질 | 무광 클레이, 모자·조끼는 살짝 보송한 펠트 질감 | 클레이 인물 레퍼런스 |

레퍼런스의 화풍만 참고하고, 특정 작품의 캐릭터는 그대로 따라 만들지 않음.

애니메이션 클립: `idle`(숨쉬기·눈 깜빡), `wave`, `present`(두 손 펼치며 골라 보라고), `pack`(붕어빵 받아 봉투에 담기), `cheer`

## 제작 방식 후보

| | A. Blender + Blender MCP (추천) | B. AI 이미지→3D (Meshy / Tripo / Rodin) | C. 지금처럼 코드로 모델링 |
|---|---|---|---|
| 품질 | 서브디비전으로 매끈한 클레이, 뼈대·애니메이션까지 직접 제작 | 형태·질감 디테일 최고, 대신 결과물을 고르기 어려움 | 기본 도형 조합이라 한계 있음 |
| 필요한 것 | Blender 설치(약 1GB) + blender-mcp 애드온/서버 | 서비스 계정 + API 키 (보통 유료 크레딧) | 없음 |
| 결과물 | `public/models/halmae.glb` (뼈대 + 클립 5개) | GLB (자동 리깅은 꼬마 비율에서 실패할 수 있음, Blender 보정 필요) | 코드 |
| 웹 적용 | `useGLTF` + `useAnimations`로 기존 장면에 교체 | 동일 | 지금 그대로 |

추천: **A로 시작**. 원하면 A 안에서 B(Rodin 등)를 섞어 머리·모자 같은 부분만 AI로 뽑은 뒤 Blender에서 다듬기.

## 승인이 필요한 항목

- **설치:** `brew install --cask blender` 실행, blender-mcp 애드온 설치, Claude MCP 설정에 `uvx blender-mcp` 서버 추가
- **영향 범위:** 로컬 앱 1개 + MCP 설정 1개. 프로젝트에는 `public/models/*.glb`와 로딩 코드만 추가
- **위험:** blender-mcp는 서드파티이고, Blender 안에서 파이썬을 실행함(로컬 소켓만 사용). 패키지는 기존 7일 최소 배포일 정책을 그대로 적용. MCP 도구는 새 세션부터 사용 가능
- **되돌리기:** `brew uninstall --cask blender`, MCP 설정에서 서버 줄 삭제, GLB 파일 삭제

## 진행 결과 (2026-11-04)

- 선택: A안. Blender 5.2.3 설치, `mcp_for_blender` 애드온 활성화(텔레메트리 꺼짐), MCP 서버 `mcp-for-blender==2.2.4` 등록(로컬 설정, `DISABLE_TELEMETRY=true`)
- 설치된 uv 0.7.21이 `~/.config/uv/uv.toml`의 `exclude-newer = "7 days"`를 읽지 못해, MCP 서버 실행에는 같은 기준의 날짜(`--exclude-newer 2026-10-28`)와 `UV_NO_CONFIG=1`을 사용
- 모델 소스: `tools/blender/build_halmae.py` → `public/models/halmae.glb` (약 3MB), 미리보기 `docs/design/img/halmae-v3.png`
- 동작은 GLB의 피벗 노드(Head, ArmL, ArmR, Body, EyesOpen, EyesHappy)를 코드에서 돌려서 표현
- v3 캐릭터 시트 반영(2026-11-04): 밤색 펠트 모자 + 크림 부클레 털 띠·귀덮개 테두리·방울, 흰 진주 뽀글머리, 진갈색 동그란 안경, 벽돌색 니트 + 크림 칼라·단추, 크림 앞치마(붕어빵 주머니) + 뒤 리본, 갈색 바지·진갈색 신발. 미리보기 `docs/design/img/halmae-v3.png`, `halmae-v3-back.png`
- 시트의 표정 중 기본(점 눈)과 눈웃음만 모델에 있음. 놀람·궁금·호호·윙크는 아직 없음
- 라이브 Blender(MCP) 턴어라운드 비교 후 수정(2026-11-04): 모자 돔을 높이고 털 롤을 두껍게, 귀덮개를 크림 테두리가 보이는 두 겹 패드로, 뒤통수 흰머리 볼륨, 허리 앞치마 끈과 큰 리본, 눈썹이 보이도록 눈·안경 위치 조정
- 라이브 작업: Blender를 연 상태에서 MCP로 `exec(open('tools/blender/build_halmae.py').read(), {'LIVE': True})` 실행 → `look`(angles)로 6면 확인
- 시트 v3 (Blender 가이드) 반영(2026-11-05): 비율 다리 0.5 : 몸통 1.2 : 머리 1.8, 귀덮개 없는 비니(밤색 돔 + 크림 털 롤 + 방울), 양옆·뒤 흰머리 볼륨, 앞치마 가슴판·어깨끈·물고기 주머니, 허리끈·뒤 리본, 갈색 바지·신발
- 파츠/피벗: Body, Head, ArmL/R, LegL/R. 표정 6종은 눈(EyesOpen/Happy/Wink/Wide) + 입(MouthSmile/O/Laugh) 조합으로 `Grandma`의 `expression`에서 교체
- 시트 정면 픽셀 측정 기반 재구성(2026-11-05): 얼굴 가로 0.40H·세로(챙~턱) 0.26H, 안경 렌즈 반경 0.2, 눈 작은 타원, 챙은 양옆으로 처지는 두툼한 롤, 흰머리는 메타볼로 합친 둥근 구름 덩어리, 가슴받이 앞치마(어깨끈·주머니·붕어빵 패치) 신발 위까지, 뒤 리본. 모자 펠트·니트 범프는 Blender 재질에만 있고 웹은 clayTextures.ts가 담당
- 참고 자료: `docs/design/ref/sheet3-*.png` (정면·측면·후면 크롭)
- **확정(2026-11-05)**: 위 치수 기반 모델에 뒷머리 덮개를 더한 버전을 할매 v3 최종으로 확정. 장면별 배치: 메뉴(bust 카메라, 손을 볼 옆으로 올리는 present 동작), 로그인 포장마차(scale 0.5, y 0.5), 진행상황 포장(scale 0.6, 붕어빵 받는 위치 HOLD [1.6, 0.6, 0.15])

## 렌더 이미지 파이프라인 (2026-11-05)

- 첨부 레퍼런스(토스·당근·밴드 캐릭터)는 오프라인 렌더라서, 보여주기 화면은 Cycles 렌더 이미지로 전환하기로 함
- 로그인: `tools/blender/render_login.py` → `public/art/login-street.png` (1125×2200, 투명 배경, Cycles 256 samples, Metal GPU). 할매는 `build_halmae.py`를 그대로 실행해 가져오고, 포장마차·동네·등불은 `src/three/CartScene.tsx`를 Blender 좌표로 옮김
- 테스트 렌더: `blender -b --factory-startup --python tools/blender/render_login.py -- out.png 32 0.4` (샘플 32, 40% 크기)
- 진행상황 화면은 단계별로 바뀌어야 해서 실시간 3D 유지
- 붕어빵 표면(2026-11-06): 몸통 양면에 큰 반원 비늘 3줄(반죽보다 한 톤 어두운 색, 자글거리지 않게), 머리 뒤 아가미 곡선, 꼬리·지느러미 방사 홈, 눈동자. 실루엣 쪽이 더 구워진 색이 되도록 Facing 기반 색 믹스. 클로즈업 확인: `... render_login.py -- out.png 48 0.5 closeup`

## 스플래시 시안 (2026-11-06)

> 확정: 시안 3 "붕어빵 공장". 아래 시안 1·2 기록은 참고용이고 스플래시에서는 쓰지 않음. 비교 탭과 `?v=` 주소, 시안 2 배경색 테스트 패널 연결은 제거

- 시안 1 "눈 오는 밤거리": `render_login.py` → `public/art/login-street.png`. 2026-11-06부터 탭에서 숨김(`?v=1`로만 열림), 기본 화면은 시안 2
- 시안 2 "붕어빵 한아름"은 제외했고 렌더 스크립트 `render_hug.py`는 참고용으로 남김. 슬롯 2는 "붕어빵 할아버지"로, 제공 이미지 `public/art/login-grandpa.png` 사용. 로고는 `src/assets/logo-hoho-grandpa.svg`(채움 크림 `#FFE2A8`→붕어빵 주황 `#EE8E2C`, 외곽선 코코아 갈색 `#4A2915`→`#5E3820`, 베이지 배경 `#CCB294` 기준)
- 이전 시안 3 "강아지 쉐프"는 2026-11-06 제외. 렌더 스크립트 `render_pup.py`만 참고용으로 남김. 당시 설정: 재질(2026-11-06 개선): 털은 펠트(시인 광택 + 섬유 범프 + 반짝이는 결), 모자·앞치마는 니트 골, 봉투는 큰 굴곡과 잔주름이 있는 점토 종이, 몸 전체에 손으로 빚은 듯한 미세 변위. 클로즈업 확인: `... render_pup.py -- out.png 64 0.6 closeup`. 오리지널 강아지 캐릭터(베이지 털, 갈색 늘어진 귀, 쉐프 모자·앞치마)가 붕어빵 종이봉투를 안고, 한 마리가 위로 튀어나옴
- (제거됨) 로그인 화면 하단 탭으로 비교하던 방식
- 시안 3 "붕어빵 공장"(2026-11-06): 제공 이미지 `docs/design/ref/factory-source.png`(참고 시트 `factory-turnaround.png`)를 `tools/art/build_factory_layers.py`로 층 분리 → `public/art/factory/*.webp`. `src/pages/FactoryScene.tsx`의 SVG가 원본 좌표계를 그대로 쓰고 `factoryScene.css`가 반복 애니메이션 담당. 프레스 3초 주기로 붕어빵 4마리가 차례로 컨베이어를 지나 쟁반으로 이동. 움직임을 끈 사용자에게는 벨트에 붕어빵이 놓인 정지 화면 표시. 로고는 `src/assets/logo-hoho-factory.svg`
- 시안 2 애니메이션(2026-11-06): `tools/art/build_grandpa_layers.py`가 `public/art/login-grandpa.png`를 배경(바닥 그림자 포함)·몸·신발 2짝으로 나눠 `public/art/grandpa/*.webp`에 저장. `src/pages/GrandpaScene.tsx`에서 배경과 그림자는 고정, 신발이 바지 밑단 뒤로 번갈아 들리고(1.4초 주기) 몸만 디딘 발 쪽으로 기울어짐. 봉지 위로 김 5줄기가 4.2초 주기로 올라가고, 흰 수염 위에서도 보이게 김 테두리에 옅은 갈색 번짐을 넣음. 원본 PNG는 층 재생성용으로만 남김. 배경은 이미지가 아니라 CSS 색(`--v2-base` 하나에서 가운데·아래를 흰색과 섞어 만듦)이고 바닥 그림자만 `shadow.webp` 투명 층. 개발 모드에서는 시안 2 우상단 '배경색 (테스트)' 패널로 색을 바꿔 볼 수 있음
- 진행상황 화면 일러스트 전환(2026-11-06): 3D 대신 codex 이미지 + SVG/CSS 애니메이션. 원본은 `docs/design/ref/bongbot/`(접수·반죽·속 넣기는 제공 이미지, 굽기·구워짐·포장·완성은 `gen/`에 codex `exec -i received.png`로 같은 구도 편집 생성). `tools/art/build_bongbot_layers.py`가 단계 프레임과 패치(빈 틀, 팥 없는 반죽, 회전 각도 0·45·90·135° 틀, 집은 붕어빵/뒤 배경)를 `public/art/bongbot/*.webp`로 만듦. `src/components/BongbotScene.tsx`가 단계별 프레임 교차 전환 + 반죽·팥 퍼짐 마스크, 틀 회전(codex로 그린 4각도 플립북, 180°+x≈x라 4장으로 반복), 붕어빵 봉투 낙하, 김·반짝이·조명 숨쉬기를 8초 안에 재생. 단계마다 가로 이동(PAN)으로 좁은 화면에서도 동작 부분이 보이게 함. 3D 코드(`src/three/BongbotScene.tsx` 등)는 남겨 둠
- codex로 여러 장을 동시에 생성하면 다른 세션의 결과 파일을 집어 오는 경우가 있어 한 장씩 생성
- 속 넣기(2026-11-06): 시작은 반죽만 보이는 깨끗한 바탕(`filling-clean.webp`, 앙금 줄기와 더미를 색으로 골라 지우고 반죽·틀 색으로만 메움). 붓기 시작(0.3초)에 앙금 줄기(`filling-stream.webp`)가 노즐에서 내려오고, 앙금 더미(`beans-0/1.webp`)가 왼쪽 칸부터 부풀어 오름. 이 단계는 틀을 1.9배 클로즈업
- 팥알 앙금(2026-11-06): codex로 `filling.png`의 앙금만 통팥알 더미 + 노즐에서 떨어지는 팥알 줄로 바꾼 `gen/filling-beads.png`(픽셀 위치 동일)를 만들고, 빌드 도구가 틀 영역(`BEADS_BOX`)만 부드러운 경계로 원본에 합성. 왼쪽 더미는 팥알 줄이 반죽에 닿는 0.6초부터 부풀어 오름
