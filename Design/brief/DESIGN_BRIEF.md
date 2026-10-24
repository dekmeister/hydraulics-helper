# Design brief — visual language for a pump operator training game

*Paste this into Claude Design (or a design-focused Claude session). Deliverable: a style-guide artifact — palette, type, component visual specs, and reference SVG comps for the two panels — that engineers can implement directly in SVG/CSS.*

---

## The product

A browser game that teaches fireground **pump operation** — reading gauges, setting valves and throttle, managing water supply and relays — in the style of Australian rural fire service equipment, but **with no real brand's logos, names, or livery**. Audience: volunteer firefighters and curious adults; it must feel like a credible training tool that happens to be fun, not a cartoon.

Two views, always both on screen:

1. **Pump panel** (the star): a close-up of the rear pump bay of a fire truck. Pressure gauges, a compound (vacuum/pressure) gauge, tank level indicator, tachometer, colour-coded valve handles for four deliveries, tank-to-pump valve, throttle, primer control, warning lamps. This is a *functional instrument cluster* — every element the player touches or reads.
2. **Scene view**: a stylised overview of the incident — truck(s), hose lays snaking to branches, firefighters, a dam or portable dam, terrain with a bit of elevation. Initially near-static, later lightly animated (water spray, charged-hose emphasis, tank levels).

Responsive: panels side-by-side on desktop/tablet, stacked (scene on top) on a 375 px portrait phone. Every control thumb-operable.

## Design goals

* **Instrument-grade legibility first.** A player must read a needle position at a glance on a phone in sunlight. Gauge faces, tick marks, and numerals are the typography showcase of this product.
* **Tactile and mechanical.** Valve handles should look like they'd resist your hand; the throttle like a real vernier/T-handle. Visual affordances for drag vs tap.
* **Honest, unbranded Australian rural-fire flavour.** Think: white/red truck body, galvanised fittings, canvas hose, dusty eucalyptus scrub, hi-vis accents — evocative of the world without imitating any agency's identity.
* **Two registers, one family.** The panel is near-photographic-schematic (precise, technical); the scene is simplified and warmer (readable at small size). They must obviously belong to the same game — shared palette, line weight logic, and lighting direction.
* **Educational states are visual states.** Cavitation, low water, overheat, over-pressure each need an unmistakable look (needle flutter, lamp colour, hose styling) that works without sound and without reading text.

## Constraints

* Everything ships as **SVG + CSS** (no raster art, no 3D). Gauges are a single parameterised component: face, scale arcs, ticks, red/amber zones, needle, label — so the design must specify these as a system, not four one-off illustrations.
* Pressure in **kPa**, flow in **L/min**. The compound gauge needs a dual scale (vacuum −100…0 kPa and pressure 0…~1600 kPa).
* Colour-coding: each delivery's valve handle, its panel gauge tag, and its hose lay in the scene share a colour so the player can trace panel→scene instantly. Colours must survive protanopia/deuteranopia — pair colour with shape/label.
* Dark-ish panel background is welcome (real panels are often dark metal) but must pass WCAG AA contrast for all readouts; the scene can be daylight.
* Touch targets ≥ 44 px; visible focus states; a `prefers-reduced-motion` variant for any animation.
* **Hard exclusions:** no NSW RFS (or any agency) logos, wordmarks, chequer patterns, or exact livery; no photorealistic humans; no gore/fire-victim imagery — fire itself is shown as stylised glow/smoke at scene edges, the visual subject is *water and machinery*.

## Deliverables

1. **Token system**: 5–7 named colours (incl. the four delivery colours + warning amber/red), type choices (a display/utility face for gauge numerals and labels — condensed, engineering-flavoured — plus a body face for tutorial text), spacing/line-weight rules.
2. **Gauge component spec**: anatomy drawing of the parameterised gauge (face, bezel, ticks, zones, needle, hub, label plate) with exact proportions, plus the compound-gauge dual-scale variant and the tank level indicator.
3. **Control specs**: valve handle (closed→open travel, drag affordance), throttle, primer, warning lamps — each with default/active/disabled/warning states.
4. **Two full comps**: the pump panel at phone width and the scene view at tablet width, using real content (four deliveries, two charged lines, a dam, one relay truck in the distance).
5. **The signature**: propose one memorable visual device unique to this game (e.g. the way charged hoses glow, or a distinctive needle design) — one, executed well.

## Anti-goals

Not a flat corporate dashboard; not skeuomorphism-for-its-own-sake with fake screws everywhere; not a pixel-art or kids-cartoon look. If a comp could be mistaken for a generic admin UI template or a match-3 game, it's wrong. The reference feeling: a beautifully drawn equipment manual that came alive.
