# Sphere 재구성 조사 기록 — Research 03

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

## 2. Research 02 평면의 변환 방법과 한계 (하부는 §8에서 교체)

공식 geometry의 구역 경계에서 방위 범위를 추출했다. 도식상의 기준점을 100/200/300/400층 각각 `(650,3839.9)`, `(2050,3839.9)`, `(2316,3839.9)`, `(2527,3839.9)`로 가정하고 `atan2(3839.9-y, x-centerX)`를 적용했다. 결과는 `src/data/plan-angles.json`에 있다.

**공식 좌석도는 측량 도면이 아니다.** 이 기준점·방위는 추정이다. 행의 의자를 모두 같은 중심의 동일한 부채꼴에 채우던 기존 방식을 폐기하고, 층별 곡률·서로 다른 구역 폭·실제 행별 수량을 사용했다. 생성 좌표는 여전히 정밀 CAD가 아니다. 행이 짧아지는 곳에서 줄어든 좌석을 어느 통로 쪽에서 빼는지까지는 확인되지 않아 행 중심에 배치한다. 출입구·토사구·세부 난간 위치의 완전한 복원도 아니다.

## 3. Research 02 단면과 내부 LED (현행 변경은 §8 참조)

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

## 7. 추가 웹 자료 확보 — 2026-10-20

자료 수집 시점에는 아래 도면을 뷰어에 반영하지 않았으며, 후속 구현 내역을 §8에 기록했다. 기존 자료와 새 발견을 함께 정리한 목록은 [29개 출처 묶음의 카탈로그](research/sphere-web-sources/catalog.json), 다운로드 결과·크기·해시는 [다운로드 기록](research/sphere-web-sources/download-manifest.json)에 있다. 로컬에 PDF 7개, 좌석 데이터 JSON 6개, 원본·고해상도 그림 18개와 PDF 미리보기 10개를 보관했다. `images`의 일부는 이전 조사에서 확보한 파일을 함께 모은 것이다. 외부 원본은 이 로컬 자료 폴더에서 Git 추적 제외하며, 공개 웹에 업로드하지 않는다.

### 가장 유용한 새 발견: U2 제작진의 2023 실무 도면

[Live Design의 2023-10-05 기사](https://www.livedesignonline.com/concerts/u2)가 조명감독 Alex Murphy가 공유한 도면으로 소개하고 직접 PDF를 연결한다. 이 [원본 PDF](https://s3.amazonaws.com/publiceditorial.qtxasset.com/live-design/2023LightingPlots/U2_LightingPlots_v02-part-2.pdf)를 내려받아 9쪽 전부 렌더링하고 확인했다. 파일 약 55.9MB, PDF 메타데이터의 제작 도구는 Vectorworks, 작성 시각은 2023-10-05다. 첨부 CAD/3D 모델은 없고, 큰 도면 그림은 폭 6,779픽셀의 래스터다.

| PDF 쪽 | 제목 | 쓸 수 있는 정보 | 주의점 |
|---|---|---|---|
| 1 | Stage - Top Plan | ft 눈금, mm 치수, 무대와 전면 곡면의 상대 위치 | U2 공연 설치 도면 |
| 2 | Stage - Top Plan | 더 넓은 객석 평면, 계단·통로·층별 곡선 배치 | 모든 좌석 좌표가 기재된 도면은 아님 |
| 3–5 | Stage Front / Left / Right | 스크린 하단, 무대, 객석 시작점의 입체 관계 | 투시도 치수를 화면 픽셀 비율로 바로 환산하면 안 됨 |
| 6–7 | Audience Left / Right | 고정 객석 단차, 발코니 앞면, 난간, 통로의 상세 관계 | 일부 조명 위치에 TBC 표기. 준공 검증본 아님 |
| 8 | Rear Audience Bar | 실제 후방 사진과 모델 그림, LED 가장자리와 검은 천장의 경계 | 기존 바 위치·수량도 확정 전이라는 주석 존재 |
| 9 | Tower Positions | 20ft/45ft, 8ft/12ft 등 타워 배치 치수 | 공연별 설치 치수이며 건물 행 좌표와 구분 |

[전체 PDF 로컬 사본](research/sphere-web-sources/documents/u2-lighting-plots-2023.pdf), [객석 평면 미리보기](research/sphere-web-sources/previews/u2-plot-2.png), [객석 측면](research/sphere-web-sources/previews/u2-plot-6.png), [후방 실제 사진 포함 쪽](research/sphere-web-sources/previews/u2-plot-8.png)을 보관했다. 2·6·7·8쪽의 큰 그림은 PDF에서 원래 해상도로 추출해 `research/sphere-web-sources/images/u2-page-*-native.png`로 저장했다.

이 자료는 2019 홍보 단면만으로 객석을 추정하던 방식보다 좋은 교차 확인 근거다. 먼저 평면의 눈금과 무대 치수로 좌표 변환을 교정하고, 고정 객석 윤곽과 통로를 추적할 수 있다. 다만 투시도에서 정확한 높이를 복구하려면 카메라 투영 보정과 별도의 확인 치수가 필요하다. 추출 그림 자체를 3D CAD로 오인하지 않는다.

### 추가로 보관한 PDF

- Cumming 프로젝트 사례 4쪽: [사본](research/sphere-web-sources/documents/cumming-sphere-case-study.pdf). 시공·납품 참여자와 건물 개요.
- AV Magazine / 7thSense 자료 5쪽: [사본](research/sphere-web-sources/documents/7thsense-av-magazine-sphere.pdf). 2024년 6–7월호 기술 기사와 단면 그림.
- Severud 포트폴리오 12쪽: [사본](research/sphere-web-sources/documents/severud-projects-2025.pdf). 구조 설계 참여사 자료이며 여러 프로젝트를 함께 수록.
- Sphere 개장 팩트시트 1쪽: [사본](research/sphere-web-sources/documents/sphere-fact-sheet-2023.pdf). 개장 시점 수치이며 제3자 사이트에 게시된 사본.
- Clark County 검토 보고서 9쪽: [사본](research/sphere-web-sources/documents/clark-county-sphere-review-2024.pdf). 승인 이력과 외부 높이 관련 서술. 상세 객석 단면은 없음.
- Bluecube Luxx 사양서 19쪽: [사본](research/sphere-web-sources/documents/luxx-specification-2020.pdf). 이전에 확보한 제조사 자료를 이번 폴더에 통합.

### 무료·유료 모델, 360도 및 사진 자료의 판별

- [TurboSquid 2349619](https://www.turbosquid.com/FullPreview/2349619): 내부만 있는 작가 제작 모델이며 Lightwave/FBX/OBJ 형식을 명시한다. 판매 설명상 약 120만 폴리곤, Lightwave/FBX 약 40MB, OBJ 약 200MB다. **실측·준공 도면 근거는 확인되지 않았다.** 구매하거나 제한된 파일을 내려받지 않았다.
- [Steam Las Vegas Spheroid](https://steamcommunity.com/sharedfiles/filedetails/?id=3603797573): 작성자가 구면 대신 **원통형 화면**을 사용했다고 명시한다. 댓글에서는 관람 위치가 고정이라고 설명한다. 충실한 실제 구조의 근거로 제외했다. 원본 항목 ID는 3442421076이다.
- [My Life in 360 영상](https://www.youtube.com/watch?v=eEye-wR7ww0): 작성자는 Insta360 One X2로 촬영한 현장 360도 영상이라고 설명한다. 촬영 구역·행·카메라 높이는 아직 확인하지 못했다. 브라우저 플러그인이 크레딧 부족을 반환하여 직접 재생 검증은 수행하지 못했다. 전체 공연 영상을 내려받지 않았다.
- [Lime360VR 영상](https://www.youtube.com/watch?v=eSnwWbCsB7A): 설명에 Unreal Engine/Blender로 만든 시뮬레이션이라고 명시하므로 현장 사진측량 자료에서 제외했다.
- [Virtually Anywhere의 thesphere 페이지](https://virtually-anywhere.com/presentations/thesphere/): 실제 내용은 서비스 소개와 다른 행사장의 예제다. Sphere 실내 투어가 확인되지 않아 제외했다.
- [Burbank 시의 MSG Dome 도면](https://www.burbankca.gov/documents/173607/0/Arch_Set-CUP_MSG-Dome-7-13-23.pdf/b9040f3a-c3f3-4617-7ec5-ebc2c420dd3a?imagePreview=1&t=1689338462191&version=1.0): 치수 도면 6쪽이지만 대상은 3401 Empire Ave의 제작시설이다. **Las Vegas 건물 치수에 대입하지 않는다.** 직접 다운로드는 403이었다.
- [RateYourSeats 106](https://www.rateyourseats.com/the-sphere-las-vegas/seating/sections/106), [206](https://www.rateyourseats.com/the-sphere-las-vegas/seating/sections/206), [306](https://www.rateyourseats.com/the-sphere-las-vegas/seating/sections/306), [406](https://www.rateyourseats.com/the-sphere-las-vegas/seating/sections/406): 구역·행이 적힌 사진 원본 URL을 찾아 `photo-manifest.json`에 기록했다. 직접 이미지 다운로드는 403이었다. 특히 106쪽의 37행 사진 링크는 파일명에 WC가 있어 위치 확정을 보류한다. 406의 일반 행 범위도 공식 예매 데이터와 다르므로 안내문은 좌표 근거로 쓰지 않는다.
- [Wikimedia의 2024-01-27 사진](https://commons.wikimedia.org/wiki/File:Preshow_dome_for_U2_concert_in_the_Sphere_on_Jan_27_2024.jpg): 설명과 EXIF, CC BY 4.0 표기를 확인했다. 사진 속 콘크리트 돔은 **실제 천장이 아니라 LED에 재생된 영상**이다. 이 표면을 건축 구조로 복원하면 오류가 생긴다. 직접 이미지 다운로드는 403이었다.

### 남아 있는 핵심 공백

공개된 전체 준공 CAD/BIM·행별 미터 좌표·현재 LED 표면의 정확한 방정식은 여전히 확보하지 못했다. 새 제작 도면은 복원에 쓸 추가 근거이며, 이 자체가 준공 동일성을 보증하지 않는다. 이번 수집에서는 계정 생성, 구매, 외부 연락, 접근 제한 우회, 웹 배포를 수행하지 않았다.



## 8. 2023 작업 도면 반영 — Research 03

### 수치로 환산한 하부 평면

원본 2쪽 그림은 6,779 × 3,760픽셀이다. 무대 전면 폭은 1쪽에 14,127mm로 표기되어 있으며, 2쪽의 대응하는 양 끝 x=2976와 x=3801 사이가 825픽셀이다. `s=825/14.127=58.39881079px/m`을 사용했다. 파란 축 원점 `(3386,611)`, 전면 LED 중앙 `(3386,594)`을 기존 LED 바닥 교점에 정합했다. X는 `(pxX-3386)/s`, Z는 `(pxY-611)/s + Zorigin`이다. 독립적인 ft 눈금은 축척과 약 1% 수준으로 부합하며 래스터 판독 오차와 선 두께가 있다.

- 추적값: `src/data/production-plan.json`. 좌우 대칭 가정 아래 왼쪽 9점을 반사해 총 17점의 다각형 윤곽을 만들었다.
- 원호 대신 추적 선분을 실제 좌판·단·지도·난간의 공통 좌표계에 적용했다.
- 중앙에 보이는 y=2318–3236의 18개 간격을 이용해 행 깊이 약 0.873305m를 산출했다. 100번대 단높이는 0.25m 추정값을 유지했다.
- 앞쪽 보이는 줄을 인벤토리 12행과 대응시킨 것은 추정이다. 상층에 가려지는 뒷열은 원호 중심 약 Z=-74m에서 뒤로 연장했다.
- 두 주요 통로의 간격과 위치를 도면에서 참고했다. 구역 번호가 없는 원본이므로 내부 티켓 구역 경계는 행별 수량에 비례해 배분했다. 짧은 최후방 행은 34행의 폭 배분을 유지한다. 이는 개별 좌석 위치를 도면에서 읽었다는 뜻이 아니다.
- 원본과 생성 위치를 겹친 `research/sphere-web-sources/previews/model-03-plan-overlay.png`로 앞·중간 행과 두 주요 통로를 육안 대조했다. 분홍 12행, 파랑 20행, 주황 30행, 보라 37행. 보라색 뒷열은 가려져 검증할 수 없다. 이 이미지는 로컬 검토용이며 공개 웹에 복사하지 않는다.

### 형상으로 반영한 부분

6–7쪽의 깊은 수직 발코니 전면과 단 아래의 수평 천장을 참고해 200번대 밑을 수평으로 변경했다. 300/400번대에는 전면 띠를 추가했다. 기존에 정확한 위치 없이 넣었던 두 스위트 띠는 제거했다. 8쪽의 실제 사진과 모델을 따라 뒤쪽 비화면부는 검은 경사 지붕·벽·보로 변경했다. 전체 안쪽 구체를 천장으로 쓰던 형상을 제거했다.

LED 끝단은 각도별 패널 단차를 적용했다. 0.35m 단차와 지붕의 높이·보 간격, 발코니 전면 깊이는 **자료에 치수가 없어 선택한 값**이다. 2023 자료에 보이는 형태를 반영한 것이며 패널 설치 도면을 추출한 것이 아니다. 기존 2019 기반 LED 반경·정점 및 200–400번대 평면·높이 추정은 남아 있다.

U2 무대는 별도 그룹으로 두고 기본 꺼짐으로 유지했다. 평면 폭/깊이 14.127m, 도면 중앙 위치, 지름 약 10.16m 원형 플랫폼을 참고했다. 높이 0.8m는 미확인 추정이다. 가변 앞좌석·전체 공연 장비를 고정 건축에 합치지 않았다.

### 검증과 공개 범위

12개 자동 검사: 기존 인벤토리·좌표·의자 간격·가림·VR UI·포인터·관객 제외 검사에 축척/추적 윤곽과 구역 경계를 건너는 의자 간격 검사를 추가했다. 도면 정합은 로컬 겹침 이미지로 확인했다. `npm test`, `npm run build`를 실행한다.

Browser Use가 이전 조사에서 크레딧 부족을 반환해 이번 변경의 브라우저 렌더와 Quest 3 실기 검증은 수행하지 못했다. 자동 기하 검사와 빌드 성공을 브라우저/헤드셋 검증으로 표현하지 않는다. 공개 배포에는 코드·자체 수치/설명만 포함하고 55.9MB 원본 PDF·겹침 이미지·강의 자료·연구 폴더를 포함하지 않는다.
