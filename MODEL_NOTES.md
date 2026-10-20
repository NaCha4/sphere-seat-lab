# Sphere baseline reconstruction — evidence and assumptions

Reviewed 2026-10-20. Units: metres, event floor y=0, stage in negative Z, original row curves centred at z=-20. This is an educational reconstruction, not an as-built model. The objective is to preserve the important sightline relationships and enable explicit replacement of uncertain geometry.

## Confirmed anchors

| Property | Public evidence | Applied interpretation |
| --- | --- | --- |
| Exterior diameter | 516 ft | 157.2768 m |
| Above-ground exterior height | 366 ft | 111.5568 m; truncated sphere centre y=32.9184 m |
| Interior LED apex above event floor | 240 ft | 73.152 m |
| Published LED surface area | 160,000 ft² | 14,864.4864 m²; tilted spherical-cap mesh fitted to this area and the apex height |
| Seating tiers | Four plus two suite levels | 100, 200, 300, 400; broad overhang at 100 rear, continuous upper bank rather than four identical balconies |
| Section IDs | Multiple event seating charts | 101–110, 201–211, 301–311, 403–409 |
| Published seat capacity | Owner science page 17,385; older architect/company documents 17,600 | Show-dependent and differently reported; rendered count is not used as proof of capacity accuracy |

The exterior, supporting roof dome and suspended interior screen are **different surfaces**. Exterior radius must not be reused as the LED radius. The interior model uses a tilted spherical cap, open toward the rear seating; it is not an all-surrounding illuminated sphere. Fitting area and apex does not establish the real as-built curvature.

## Explicit estimates

`src/layout.js` centralises parameters; `src/auditorium.js` constructs geometry from them.

- Screen radius55m and tilt35° are estimated from the photographic silhouette and section. Centre y=18.152, z=-13. Cap height is derived from area/(2πr); the analytical surface area is14,864.4864m² and its highest point is73.152m. Triangulated mesh area is verified within0.5%. These two fitted constraints do not establish the real radius, tilt or projection calibration.
- Main row numbers 12–37 by default, optional retractable 1–11. Terrace 1–21. Lower Gallery central sections up to20, ends as few as9. Upper Gallery centre up to25, outer sections13. Rows from secondary seating guides; not a verified ticketing inventory.
- Row depth, rise and seat pitch: inferred from section drawings, photos and proportions. Seat pitch .63 m. Seated eye height1.18 m above model tread.
- Stage: generic25×13 m rectangle, top1.2 m. Event-specific U2, Metallica or other stages are not treated as permanent architecture.
- Suite bands and railings: approximate visible structure. The pronounced first overhang is retained because it directly affects 100-level upper-screen visibility.
- Individual seat numbering is generated monotonically within model rows. It must not be used to buy real tickets.
- An AI-generated Chiikawa fan illustration fills the screen by default. The procedural Earth/horizon, star field and UV grid remain optional test content. These are not actual Sphere film frames. The UV grid is not a calibrated equal-angle reticle. See ASSET_NOTES.md for the generated asset and prompt.
- Model-derived distances/yaw differences describe this reconstruction only. VR optics and field of view are headset-dependent.

## Primary sources

1. Sphere, **The Science** — <https://www.thesphere.com/science>. LED area, current published Bowl capacity, screen wrapping over and behind audience.
2. Sphere, **Venue Maps** — <https://www.thesphere.com/plan-your-visit/maps>. Building access levels and bowl/concourse envelope. 300 plus400 rows1–15 use Lower Gallery; 400 rows16+ Upper Gallery.
3. Populous, **Sphere** — <https://populous.com/showcases/sphere>. Design, four tiers/two suites, screen apex240ft,9mm pitch. The page's body says366ft external height while one facts widget says336ft; use366ft corroborated by structural engineer.
4. Severud, **Sphere at The Venetian** — <https://www.severud.com/left-side-main-picture/sphere-at-the-venetian/>. Exterior dimensions and distinct structural systems.
5. STRUCTURE, **The Structural Genome of Sphere** — <https://www.structuremag.org/article/the-structural-genome-of-sphere/>. Technical construction and separate roof/screen support.
6. Cast Connex, **Sphere Las Vegas** — <https://www.castconnex.com/projects/sphere-las-vegas>. Labeled cross-section distinguishing interior, exosphere and LED trellis.
7. Sphere/7thSense announcement — <https://investor.sphereentertainmentco.com/press-releases/news-details/2023/Sphere-and-7thSense-Partner-to-Power-Content-on-Spheres-Interior-and-Exterior-LED-Displays/default.aspx>. Screen resolution, area and height.
8. Optica OPN, **The Sphere Lights Up the Vegas Strip** — <https://www.optica-opn.org/home/newsroom/2023/august/the_sphere_lights_up_the_vegas_strip/>. Engineering interview. Its~165° viewing description is not interpreted as an exact horizontal azimuth.
9. Ticketmaster, **Sphere venue** — <https://www.ticketmaster.com/sphere-tickets-las-vegas/venue/189524>. Section numbering and show-dependent plans. Current Metallica floor plan has a show-specific Snake Pit.

## Secondary visual cross-checks

10. RateYourSeats — <https://www.rateyourseats.com/the-sphere-las-vegas/seating>. Seat photographs and100-level rear obstruction.
11. MapaPlan — <https://www.mapaplan.com/seating-plan/las-vegas-sphere-arena-msg-dome-globe-detailed-seat-row-numbers-chart/las-vegas-sphere-msg-seating-chart-plan.htm>. Row ranges, checked against other images; contains generic claims that are not accepted as geometry evidence.
12. Upfront — <https://upfront.tickets/venues/sphere/seating-chart>. Tapered end sections. Unverified row inventory.
13. Las Vegas Review-Journal — <https://neon.reviewjournal.com/entertainment/the-sphere-everything-you-need-to-know/>. Cutaway of fixed seating versus flexible floor.

`sites.3ddigitalvenue.com/3dmap/clients/sphere/` was investigated but declares no affiliation and redirects some content to seatseven.io; not treated as an official geometry source. London Sphere proposal drawings are excluded. Public references are linked rather than redistributed.

## Next fidelity improvements

Obtain actual CAD/BIM or measured sectional dimensions; replace inferred screen axes and row coordinates; validate selected100/200/300/400 seat views against same-lens photographs; replace generated seat numbering with verified event-specific inventories. Preserve the distinction between geometric comparison and measured discomfort reduction.
