export const SOURCES = [
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
  ['출처 간 교차 확인', '4개 객석 층 · 101–110 / 201–211 / 301–311 / 403–409 구역 · 100번대 뒤쪽 상부 가림'],
  ['시각 자료로 추정', '내부 화면 축과 가장자리 · 행 간격·단높이 · 좌석 수·좌표 · 발코니 깊이 · 무대 크기'],
];
