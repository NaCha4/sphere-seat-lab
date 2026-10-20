export const SOURCES = [
  { name: 'Ticketmaster · Eagles geometry', type: '공식 예매 데이터', url: 'https://mapsapi.tmol.io/maps/geometry/3/event/17006484FED61E34?systemId=HOST', note: '39개 구역의 숫자 행과 행별 수량을 가져옴. 일반 위치 13,830개·WC 178개. 개별 티켓 번호와 미터 좌표는 없음.' },
  { name: 'Ticketmaster · Metallica geometry', type: '독립 공연 설정 교차 확인', url: 'https://mapsapi.tmol.io/maps/geometry/3/event/17006461A5E3E208?systemId=HOST', note: '39개 구역의 모든 숫자 행·행별 수량이 Eagles와 일치. 206구역 WC 포함 여부는 다름.' },
  { name: 'Tana Helean · Sphere Quickstart', type: '전 Sphere 설계·R&D 담당자', url: 'https://tanahelean.com/works/sphere', note: '2019 설계 단계 단면·평면. 화면 원형 프로파일과 객석 높이 비율을 조건부 환산. 2023 준공도면이 아님.' },
  { name: 'Irwin · Define & Design', type: '실제 좌석 제조사', url: 'https://www.irwinseating.com/define-design', note: 'Sphere와 Luxx 제품군 연결 확인. 설치된 세부 옵션·폭은 확인되지 않음.' },
  { name: 'Bluecube · Luxx specification', type: '제조사 공개 치수도', url: 'https://www.bluecubeseating.com/wp-content/uploads/2020/05/luxx-specification-2020.pdf', note: '14–15쪽의 좌판 높이·좌석 폭 옵션·레일 마운트·팔걸이 구조 참고. 580mm 좌석 간격 옵션을 추정 모델에 채택.' },
  { name: 'HOLOPLOT · Sphere', type: '설치 음향 시스템 제조사', url: 'https://www.holoplot.com/case-studies/msg-sphere-case-study', note: '프로시니엄 어레이 33.6×6.6m, 마지막 행까지 약 110m. 객석 아래 음향 설비와 가림 구조 확인.' },
  { name: 'SPACETIME · Sphere Digital Twin', type: '내부 LED 구조 제작 참여사', url: 'https://www.spacetime.rs/p_sphere.html', note: '실제 제작용 Rhino/Grasshopper 모델의 존재 확인. 공개 모델 파일·재배포 라이선스는 확보하지 못함.' },
  { name: 'Sphere · The Science', type: '공연장 공식', url: 'https://www.thesphere.com/science', note: '내부 LED 160,000 ft², Bowl 좌석 17,385석, 관객 위와 뒤로 이어지는 화면.' },
  { name: 'Sphere · Venue Maps', type: '공연장 공식', url: 'https://www.thesphere.com/plan-your-visit/maps', note: 'Main / Terrace / Lower Gallery / Upper Gallery의 층별 접근과 외곽 형상. 건물 층과 좌석 100–400번대는 다른 체계.' },
  { name: 'Populous · Sphere', type: '설계 건축사', url: 'https://populous.com/showcases/sphere', note: '4개 객석 층과 2개 스위트 층, 말굽형 객석, 내부 화면 정점 240 ft, 9 mm 픽셀 피치.' },
  { name: 'Severud · Sphere at The Venetian', type: '구조 설계사', url: 'https://www.severud.com/left-side-main-picture/sphere-at-the-venetian/', note: '외피 직경 516 ft, 높이 366 ft. 외피·지붕·내부 미디어 면을 구분한 단면.' },
  { name: 'STRUCTURE · The Structural Genome of Sphere', type: '설계진 기술 기고', url: 'https://www.structuremag.org/article/the-structural-genome-of-sphere/', note: '객석 bowl, 지붕, 매달린 미디어 면이 별도 구조임을 설명.' },
  { name: 'Cast Connex · Sphere Las Vegas', type: '구조 공급사', url: 'https://www.castconnex.com/projects/sphere-las-vegas', note: 'Immersive Surface / Exosphere / Exterior LED Trellis를 구분한 단면도.' },
  { name: 'Sphere & 7thSense', type: '운영사 공식', url: 'https://investor.sphereentertainmentco.com/press-releases/news-details/2023/Sphere-and-7thSense-Partner-to-Power-Content-on-Spheres-Interior-and-Exterior-LED-Displays/default.aspx', note: '16K × 16K 내부 디스플레이, 정점 240 ft, 면적 160,000 ft².' },
  { name: 'Optica · The Sphere Lights Up the Vegas Strip', type: '기술 책임자 인터뷰', url: 'https://www.optica-opn.org/home/newsroom/2023/august/the_sphere_lights_up_the_vegas_strip/', note: '촬영·투영과 곡면 스크린의 시야 범위를 설명. 약 165°라는 설명을 수평 중심각으로 단정하지 않음.' },
  { name: 'Ticketmaster · Sphere', type: '공식 티켓 판매', url: 'https://www.ticketmaster.com/sphere-tickets-las-vegas/venue/189524', note: '구역 번호 체계의 교차 확인. 표시되는 무대·플로어는 공연마다 다름.' },
  { name: 'RateYourSeats · Sphere Seating', type: '사진 기반 보조 자료', url: 'https://www.rateyourseats.com/the-sphere-las-vegas/seating', note: '100번대 뒷열의 상부 화면 가림과 위치별 실제 관람 사진을 비교.' },
  { name: 'MapaPlan · Sphere seating', type: '보조 자료', url: 'https://www.mapaplan.com/seating-plan/las-vegas-sphere-arena-msg-dome-globe-detailed-seat-row-numbers-chart/las-vegas-sphere-msg-seating-chart-plan.htm', note: '구역·행 범위 참고. 실제 좌석 좌표를 제공하는 측량 자료가 아니며, 다른 출처와 함께 사용.' },
  { name: 'Upfront · Sphere seating', type: '보조 자료', url: 'https://upfront.tickets/venues/sphere/seating-chart', note: '300·400번대 양 끝 구역이 짧아지는 행 구성을 참고. 모델의 행·좌석 위치는 추정.' },
];

export const CONFIDENCE = [
  ['공식 수치', '외피 직경 157.28 m · 높이 111.56 m · 화면 정점 73.15 m · 화면 면적 약 14,864 m²'],
  ['공식 예매 데이터 교차 확인', '39개 구역 · 실제 숫자 행 · 행별 수량. 206: 7–16행 / 406: 4–23행. 공연 2종의 일반 좌석 데이터 일치'],
  ['추정이며 준공 검증되지 않음', '2019 단면을 환산한 화면·객석 높이 · 층별 곡률 · 행 깊이·단높이 · 의자 폭 · 발코니·천장 · 모든 좌석의 미터 좌표'],
];
