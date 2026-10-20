# Sphere 재구성 조사 기록 — Research 02

조사일: 2026-10-20. 대상: **Las Vegas Sphere의 고정 객석과 내부 LED**. 공연별 설치는 분리한다.

## 먼저 밝혀야 할 결론

이 버전은 공개 자료에 근거를 더한 재구성이다. **실제 준공 모델을 가져온 복제본이 아니다.** 내부 제작용 BIM과 디지털 트윈의 존재는 확인했으나, 공개적으로 내려받고 사용할 수 있는 준공 좌표/모델은 확보하지 못했다. 따라서 실제 좌석에서의 시야 가림을 정량 검증한 결과로 제출해서는 안 된다. 아이디어의 공간적 작동을 탐색하는 모델과 현장 검증은 구분해야 한다.

## 1. 그대로 가져온 데이터

[Ticketmaster Eagles 공개 geometry 응답](https://mapsapi.tmol.io/maps/geometry/3/event/17006484FED61E34?systemId=HOST)의 숫자 행과 `totalPlaces`를 `src/data/seat-inventory.json`에 옮겼다. [Metallica 응답](https://mapsapi.tmol.io/maps/geometry/3/event/17006461A5E3E208?systemId=HOST)과 39개 구역 전체의 숫자 행/수량이 일치한다. [Wizard 응답](https://mapsapi.tmol.io/maps/geometry/3/event/170064E7975C9138?systemId=HOST)의 활성 25개 구역도 같은 숫자 행/수량이다.

| 항목 | 반영 |
|---|---|
| 구역 | 101–110, 201–211, 301–311, 403–409: 총 39개 |
| 206 | 7–16행, 7행 14자리·16행 16자리 |
| 306 | 6–18행 |
| 406 | 4–23행, 마지막 숫자행 30자리 |
| 301/311 | 1–10행, 마지막 행 2자리 |
| 일반 숫자행 위치 | 13,830개 |
| 별도 WC 인벤토리 | Eagles 178개. 정확한 위치 미확보로 의자로 생성하지 않음 |

이 숫자는 [공연장 공식](https://www.thesphere.com/science)의 명목 좌석 수 17,385와 집계 범위가 다르다. 숫자를 맞추려고 누락 행이나 좌석을 임의로 추가하지 않았다. 100번대 가변 앞좌석, 스위트 및 행사별 재배치는 이 인벤토리와 구분한다. 조회 응답에는 **개별 티켓 좌석 번호 및 미터 좌표가 없다.** 앱의 `1번째…` 표시는 한 행 안에서 생성한 순번이다.

## 2. 평면의 변환 방법과 한계

공식 geometry의 구역 경계에서 방위 범위를 추출했다. 도식상의 기준점을 100/200/300/400층 각각 `(650,3839.9)`, `(2050,3839.9)`, `(2316,3839.9)`, `(2527,3839.9)`로 가정하고 `atan2(3839.9-y, x-centerX)`를 적용했다. 결과는 `src/data/plan-angles.json`에 있다.

**공식 좌석도는 측량 도면이 아니다.** 이 기준점·방위는 추정이다. 행의 의자를 모두 같은 중심의 동일한 부채꼴에 채우던 기존 방식을 폐기하고, 층별 곡률·서로 다른 구역 폭·실제 행별 수량을 사용했다. 생성 좌표는 여전히 정밀 CAD가 아니다. 행이 짧아지는 곳에서 줄어든 좌석을 어느 통로 쪽에서 빼는지까지는 확인되지 않아 행 중심에 배치한다. 출입구·토사구·세부 난간 위치의 완전한 복원도 아니다.

## 3. 단면과 내부 LED

[Tana Helean의 공개 포트폴리오](https://tanahelean.com/works/sphere)에 수록된 **2019 Sphere Quickstart** 단면과 평면, [Cast Connex 단면](https://www.castconnex.com/projects/sphere-las-vegas), [Severud 구조 설명](https://www.severud.com/left-side-main-picture/sphere-at-the-venetian/)을 비교했다. Quickstart는 준공 전 자료다. [PCI/StrucSoft 사례](https://www.strucsoftsolutions.com/wp-content/uploads/2024/05/SS-Case-Study-Design-MSG-Sphere-PCI-Las-Vegas-2024_V1.pdf)는 이후 BIM 설계 수정이 200회 이상 있었다고 설명하므로, 이 그림을 현재의 확정 치수로 간주할 수 없다.

단면 확대본의 기준 픽셀은 바닥 y=1168, 화면 정점 `(1020,103)`, 표시된 world origin `(1020,949)`다. [Populous](https://populous.com/showcases/sphere)의 정점 240ft를 조건부 대응시켜 `s=73.152/(1168-103)=0.0686873m/px`로 환산했다. `Z=(pxX-1020)s`, `Y=(1168-pxY)s`이며, 원형 화면 반경 약 58.11m·중심 높이 약 15.04m를 얻는다. **그림의 날짜와 높이 출처가 다르다는 가정이 들어간다.**

| 층 | 후단 Z / Y 앵커(m) | 행 깊이 추정(m) | 단높이 추정(m) | 후단 행 곡률 반경(m) |
|---|---:|---:|---:|---:|
| 100 | 4.81 / 6.73 | 0.82 | 0.25 | 80 |
| 200 | 5.84 / 21.84 | 0.90 | 0.48 | 80 |
| 300 | 19.92 / 34.48 | 0.90 | 0.60 | 106 |
| 400 | 45.33 / 50.97 | 0.90 | 0.64 | 126 |

후단 앵커는 노출된 주 객석대의 윤곽에서 읽었으며 판독 오차 약 10–25px와 현행 행 번호 대응의 불확실성이 있다. 행 깊이·단높이·곡률 반경은 위 윤곽, 좌석 수, 580mm 간격을 함께 만족시키기 위한 **재구성 선택값**이다. 측정값으로 인용하지 않는다.

LED는 이 원형 프로파일을 바닥에서 자르고 후방을 약 42° 기울어진 평면으로 근사 절단한다. 절단 오프셋 15.57436m는 공표 면적 약 14,864m²에 맞춘 값이다. 실제 뒤쪽 가장자리는 불규칙하므로 단일 평면과 일치한다고 검증되지 않았다. 삼각형 면적 합 약 14,862.9m², 정점 73.152m는 **모델 내부 일관성 검사**일 뿐 준공 정확도의 증명이 아니다.

비화면부 어두운 천장, 발코니 두께 1.3m, 두 스위트 띠, 세부 난간은 단면과 구조를 읽기 위한 추정 형상이다. 기존처럼 외부 구체를 실제 내부 천장으로 해석하지 않는다. 구분색은 실제 마감재를 보증하지 않는다.

## 4. 좌석과 인체

[Irwin](https://www.irwinseating.com/define-design)은 Sphere에 쓰인 제품군을 Luxx와 연결한다. [Bluecube Luxx 사양서](https://www.bluecubeseating.com/wp-content/uploads/2020/05/luxx-specification-2020.pdf)의 14–15쪽 및 [Irwin Luxx](https://www.irwinseating.com/luxx)를 참고해 레일, 지주, 접이식 좌판, 측면 패널, 팔걸이, 컵홀더를 변경했다.

좌판 위 높이 450mm와 폭 옵션을 참고했으나 Sphere에 발주된 정확한 옵션은 미확보다. 목표 간격은 580mm이며 좁은 행의 의자 형상은 530/555mm 폭 옵션으로 축소한다. 간격·폭·등받이 약 12°는 선택값이다. 2019 가이드 본문 12°와 그림 12.5°도 서로 차이가 있다. 관객 신장 분포와 눈높이 1.18m는 시뮬레이션 가정이다. 인체 간섭은 실제 관객 실험 결과가 아니다.

## 5. 찾았으나 가져오지 못한 것

- [SPACETIME](https://www.spacetime.rs/p_sphere.html) / [OnceMore](https://www.programmingarchitecture.com/project-msg-sphere.html): 실제 내부 LED 디지털 트윈·제작 파일 생성 작업 확인. 공개 모델 다운로드 없음.
- [HOLOPLOT](https://www.holoplot.com/case-studies/msg-sphere-case-study): 33.6×6.6m 프로시니엄 어레이와 마지막 행까지 약 110m라는 별도 규모 단서. 좌표 파일 없음. 무대 가장자리까지의 거리와 혼동하지 않음.
- Clark County의 UC-17-1096 / WS-18-0218 및 [SEC 공개 계약](https://www.sec.gov/Archives/edgar/data/1636519/000163651918000010/tmsgcexhibit10600630201810k.htm): 승인 이력 확인. 공개 계약에서 도면 목록은 생략돼 있음.
- 3DDigitalVenue 연동 경로는 발견했으나 접근 설정이 403 응답. 인증·접근 제한을 우회하지 않았으며 해당 파노라마나 좌표를 검증했다고 주장하지 않는다.
- 실제 관객 사진의 구역/행 출처는 네 층 모두 발견했지만 일부 이미지 원본 접근은 403. 렌즈·카메라 높이를 보정한 사진 대조는 완료하지 못했다.

수동 대조를 위해 찾은 관객 사진의 위치 메타데이터: [106/33/7](https://aviewfrommyseat.com/venue/the%2Bsphere%2C%2Bvegas/106/33/7/), [204/14/3](https://aviewfrommyseat.com/photo/317686/The%2BSphere%2C%2BVegas/section-204/row-14/seat-3/), [306/18/15](https://aviewfrommyseat.com/venue/The%2BSphere%2C%2BVegas/306/18/15/), [407/25/6](https://aviewfrommyseat.com/photo/309456/The%2BSphere%2C%2BVegas/section-407/row-25/seat-6/). 사용자 기재 위치이며 현장 측량으로 검증한 좌표는 아니다.

## 6. 검증 범위

자동 검사: 39개 구역, 공식 행/수량과의 일치, 좌표 유효성, 의자 간격, 건물 외피 안 위치, 하부 후방 발코니 가림, 앞쪽·200층·400층의 상단 LED 접근, 화면 면적/정점/바닥 절단, VR UI 우선순위, 포인터 강조, 내 자리를 제외하는 관객 처리. `npm test`와 `npm run build`를 실행한다.

이 검사는 소프트웨어와 가정의 일관성을 검사한다. **현장 실측·준공 CAD 대조·Quest 3 실기 검증은 수행하지 않았다.** 향후 실제 모델 또는 수치가 확보되면 `src/layout.js`의 추정 파라미터와 화면 절단 형상을 교체해야 한다.

공개 원본 도면·사진·제조사 PDF는 사이트에 재배포하지 않는다. 자료 링크, 사실 수치, 자체 작성 코드만 공개한다.
