'use strict';

/**
 * Standard construction site inspection library.
 *
 * Each inspection type groups its requirements. A requirement has a `kind`:
 *   check    – visual / workmanship check marked Pass / Fail / Action / N/A
 *   photo    – photographic evidence must be uploaded against the item
 *   document – a record / certificate / test report must be received
 *   measure  – a reading or measurement is recorded (value + unit)
 *
 * Built from common Inspection & Test Plan (ITP) hold points (pre-pour,
 * pre-cover, pre-plaster, handover) and routine site safety walk-throughs.
 * Companies edit this list from Site Inspection → Library.
 */
const c = (text) => ({ text, kind: 'check' });
const p = (text) => ({ text, kind: 'photo' });
const d = (text) => ({ text, kind: 'document' });
const m = (text) => ({ text, kind: 'measure' });

const INSPECTION_LIBRARY = [
  {
    key: 'site_photos', name: 'Site Photographs / Progress Evidence', category: 'evidence',
    description: 'Photo record of the site — overall progress, work fronts and any problem areas.',
    items: [p('Site entrance & signboard'), p('Overall site view (all four sides)'), p('Current work front / activity in progress'), p('Material stock at site'), p('Labour on site (headcount view)'), p('Problem areas / defects noticed'), c('Photos clear, dated and taken today')],
  },
  {
    key: 'safety_walk', name: 'Daily Safety Walk', category: 'safety',
    description: 'Routine HSE walk-through of the whole site.',
    items: [c('Barricading, hard fencing & warning signage in place'), c('PPE worn by all workers (helmet, shoes, vest, gloves)'), c('Edge protection / guard rails at open edges & shafts'), c('Scaffolding erected properly and tagged'), c('Ladders secured and in good condition'), c('Temporary electrical: DB with ELCB/RCCB, no loose wiring'), c('Fire extinguishers available and not expired'), c('First-aid box stocked; trained first-aider on site'), c('Housekeeping — debris, nails, scrap cleared'), c('Drinking water & toilets for workers'), p('Photo of any unsafe condition found')],
  },
  {
    key: 'scaffolding', name: 'Scaffolding & Work at Height', category: 'safety',
    description: 'Before use and weekly for any scaffold or work at height.',
    items: [c('Base plates / sole boards on firm ground'), c('Standards plumb, ledgers level, bracing complete'), c('Working platform fully boarded, no gaps'), c('Guard rails & toe boards at all open sides'), c('Tied to structure at required intervals'), c('Safe access ladder provided'), c('Full-body harness used and anchored above head'), d('Scaffold inspection tag signed by competent person'), p('Photo of scaffold with tag')],
  },
  {
    key: 'excavation', name: 'Excavation & Earthwork', category: 'quality',
    description: 'Before PCC / foundation work.',
    items: [c('Setting out / centre line checked against drawing'), m('Excavation depth (as per drawing)'), c('Bottom level and dimensions correct'), c('Soil strata matches design assumption'), c('No water logging — dewatering arranged'), c('Side slopes / shoring stable'), c('Excavated earth kept 1 m away from edge'), c('Barricading around the pit'), p('Photo of excavated pit with measuring staff')],
  },
  {
    key: 'pcc_footing', name: 'Foundation / Footing (Pre-pour)', category: 'quality',
    description: 'Hold point before concreting footings.',
    items: [c('PCC bed level & thickness correct'), c('Footing size and position as per drawing'), c('Reinforcement dia, spacing & number of bars as per BBS'), c('Cover blocks provided (bottom & sides)'), c('Column starter bars in position & plumb'), c('Shuttering tight, oiled & braced'), c('Pit cleaned — no loose soil, water or debris'), p('Photo of reinforcement before pour')],
  },
  {
    key: 'formwork', name: 'Formwork / Shuttering', category: 'quality',
    description: 'Check before reinforcement and before concreting.',
    items: [c('Line, level & plumb of shuttering'), c('Dimensions match drawing'), c('Props / supports at correct spacing, on firm base'), c('Joints sealed — no gaps for slurry leakage'), c('Shuttering oil / release agent applied'), c('Openings & sleeves for services provided'), c('Working platform and access for pour crew'), p('Photo of completed shuttering')],
  },
  {
    key: 'reinforcement', name: 'Reinforcement (Pre-pour)', category: 'quality',
    description: 'Hold point — no concreting until passed.',
    items: [c('Bar diameter, number & spacing as per drawing / BBS'), c('Lap lengths and lap locations correct'), c('Development length / anchorage at supports'), c('Stirrups / rings spacing and hooks (135°)'), c('Cover blocks of correct size fixed'), c('Chairs provided for top steel'), c('Bars clean — no loose rust, oil or mud'), c('Binding wire tied at all crossings'), d('Steel test certificate / brand verified'), p('Photo of reinforcement with tape')],
  },
  {
    key: 'concreting', name: 'Concreting (Pour Day)', category: 'quality',
    description: 'During the pour.',
    items: [c('Formwork & reinforcement approved before pour'), d('Concrete grade / RMC delivery challan checked'), m('Slump test value'), c('Cube samples taken (set of 3 per batch)'), c('Needle vibrator used — no over/under vibration'), c('Pour in layers; no free fall above 1.5 m'), c('Construction joints at approved locations'), c('Finishing / level of top surface'), p('Photo during pour'), p('Photo of cube samples with labels')],
  },
  {
    key: 'curing_deshuttering', name: 'Curing & De-shuttering', category: 'quality',
    description: 'After concreting.',
    items: [c('Curing started within 24 hours'), c('Curing continued for minimum 7–14 days'), c('De-shuttering after minimum stripping time'), c('No honeycombing, cracks or exposed steel'), c('Surface line & level after stripping'), d('7-day / 28-day cube test result received'), p('Photo of concrete surface after de-shuttering')],
  },
  {
    key: 'masonry', name: 'Brickwork / Blockwork', category: 'quality',
    description: 'During and after masonry work.',
    items: [c('Bricks / blocks soaked (if clay) and of approved quality'), c('Mortar mix ratio as specified'), c('Line, level & plumb of walls'), m('Joint thickness (mm)'), c('Joints fully filled, raked for plaster'), c('Courses bonded — no continuous vertical joints'), c('Lintels / sills at correct level'), c('Gap above last course packed properly'), c('Curing of masonry'), p('Photo of completed wall')],
  },
  {
    key: 'plumbing_rough', name: 'Plumbing Rough-in (Pre-plaster)', category: 'mep',
    description: 'Hold point before walls / floors are closed.',
    items: [c('Pipe routes and sizes as per drawing'), c('Concealed pipes fixed and clamped'), c('Slope of drainage lines correct'), m('Pressure test — pressure held (kg/cm²)'), c('No leakage at joints during test'), c('Floor traps / outlets at correct level'), p('Photo of concealed pipes before closing')],
  },
  {
    key: 'electrical_rough', name: 'Electrical Rough-in (Pre-plaster)', category: 'mep',
    description: 'Hold point before plastering.',
    items: [c('Conduit routes as per electrical layout'), c('Conduit size and junction boxes correct'), c('Switch / socket box heights as per drawing'), c('Draw wire inserted in all conduits'), c('Earthing conductor run provided'), p('Photo of conduits before plaster')],
  },
  {
    key: 'waterproofing', name: 'Waterproofing', category: 'quality',
    description: 'Bathrooms, terraces, sunken slabs, water tanks.',
    items: [c('Surface cleaned and prepared'), c('Coving / fillets at wall-floor junction'), c('Waterproofing coats applied as specified'), c('Lapping up the walls to required height'), m('Ponding test duration (hours)'), c('No leakage observed below after ponding test'), d('Product batch / data sheet'), p('Photo of ponding test')],
  },
  {
    key: 'plastering', name: 'Plastering', category: 'quality',
    description: 'Internal and external plaster.',
    items: [c('Surface hacked / cleaned and wetted'), c('Chicken mesh at RCC–masonry joints'), c('Mortar mix ratio as specified'), m('Plaster thickness (mm)'), c('Line, level & plumb — checked with straight edge'), c('Corners and edges true'), c('No cracks or hollow sound'), c('Curing done'), p('Photo of finished plaster')],
  },
  {
    key: 'tiling_flooring', name: 'Tiling / Flooring', category: 'quality',
    description: 'Floor and wall tiles, stone.',
    items: [c('Approved tile / stone and batch'), c('Base level and slope towards drains'), c('Tiles fixed with correct adhesive / mortar bed'), c('No hollowness (tap test)'), c('Joint width uniform and grouted'), c('Line, level & pattern as per drawing'), c('Skirting / dado finished'), p('Photo of finished flooring')],
  },
  {
    key: 'painting', name: 'Painting & Finishes', category: 'quality',
    description: 'Putty, primer and paint.',
    items: [c('Surface dry, cracks filled'), c('Putty coats sanded smooth'), c('Primer applied'), c('Number of paint coats as specified'), c('Shade matches approved sample'), c('No patches, runs or brush marks'), p('Photo of finished room')],
  },
  {
    key: 'material_receipt', name: 'Material Receipt Inspection', category: 'evidence',
    description: 'When material arrives at site.',
    items: [d('Delivery challan / invoice received'), c('Quantity matches PO and challan'), c('Brand / grade as approved'), c('No damage during transport'), d('Test certificate (steel, cement, RMC) received'), p('Photo of material as received'), p('Photo of challan')],
  },
  {
    key: 'handover', name: 'Pre-handover / Snag Inspection', category: 'handover',
    description: 'Before handing the unit / building to the client.',
    items: [c('Doors & windows operate smoothly, locks working'), c('All electrical points, switches & DB tested'), c('Plumbing fixtures — no leaks, good flow'), c('Drainage and floor traps flowing'), c('Paint, tiles and finishes without defects'), c('Site and unit cleaned'), d('As-built drawings / warranties handed over'), d('Keys and handover checklist signed by client'), p('Photos of each room at handover')],
  },
];

const KINDS = ['check', 'photo', 'document', 'measure'];
const CATEGORIES = ['quality', 'safety', 'mep', 'evidence', 'handover', 'other'];

// Accepts legacy string items ({ items: ['...'] }) and returns the typed shape.
function normalizeType(t, i = 0) {
  return {
    key: t.key || `type_${i}`,
    name: t.name || 'Untitled',
    category: CATEGORIES.includes(t.category) ? t.category : 'other',
    description: t.description || '',
    items: (t.items || [])
      .map((it) => (typeof it === 'string' ? { text: it, kind: 'check' } : { text: it?.text || it?.item || '', kind: KINDS.includes(it?.kind) ? it.kind : 'check' }))
      .filter((it) => it.text.trim()),
  };
}

module.exports = { INSPECTION_LIBRARY, KINDS, CATEGORIES, normalizeType };
